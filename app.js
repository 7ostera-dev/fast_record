const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const downloadLink = document.getElementById('downloadLink');
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d'); 
const microphoneSelect = document.getElementById('microphoneSelect');
const screenPreview = document.getElementById('screenPreview');
const countdown = document.getElementById('countdown');

let mediaRecorder;
let recordedChunks = [];
let countdownValue = 3; // العد التنازلي
let audioContext;
let analyser;
let source;
let screenStream;
let microphoneStream;

async function getMicrophones() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices.filter(device => device.kind === 'audioinput');

    microphones.forEach(microphone => {
        const option = document.createElement('option');
        option.value = microphone.deviceId;
        option.textContent = microphone.label || `ميكروفون ${microphone.deviceId}`;
        microphoneSelect.appendChild(option);
    });
}

async function startPreview() {
    try {
        await getMicrophones();

        const selectedMicrophoneId = microphoneSelect.value;

        // طلب تدفق الفيديو من الشاشة
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });

        // طلب تدفق الصوت من الميكروفون
        microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: selectedMicrophoneId ? { exact: selectedMicrophoneId } : undefined }
        });

        // عرض الشاشة في الفيديو للمعاينة
        screenPreview.srcObject = screenStream;

        // إعداد Web Audio API لتحليل الصوت من الميكروفون
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaStreamSource(microphoneStream);
        analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // رسم الموجات الصوتية
        const draw = () => {
            requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);

            let maxAmplitude = 0;
            for (let i = 0; i < bufferLength; i++) {
                maxAmplitude = Math.max(maxAmplitude, dataArray[i]);
            }

            let color;
            if (maxAmplitude > 200) {
                color = 'rgb(255, 0, 0)'; // أحمر لقوة الصوت العالية
            } else if (maxAmplitude > 150) {
                color = 'rgb(255, 165, 0)'; // برتقالي لقوة الصوت المتوسطة
            } else {
                color = 'rgb(4, 236, 81)'; // أخضر لقوة الصوت المنخفضة
            }

            canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.8)'; 
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height); 
            canvasCtx.lineWidth = 2; 
            canvasCtx.strokeStyle = color; 
            canvasCtx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0; 
                const y = v * canvas.height / 2;
                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke(); 
        };

        draw(); 

    } catch (err) {
        console.error("Error: " + err);
        alert('حدث خطأ: ' + err.message);
    }
}

startBtn.addEventListener('click', () => {
    // العد التنازلي ثم بدء التسجيل
    countdown.style.display = 'block';
    countdown.textContent = countdownValue;
    const countdownInterval = setInterval(() => {
        countdownValue--;
        countdown.textContent = countdownValue;

        if (countdownValue === 0) {
            clearInterval(countdownInterval);
            countdown.style.display = 'none';
            startRecording();
        }
    }, 1000);
});

function startRecording() {
    // دمج الفيديو والصوت في تدفق واحد
    const combinedStream = new MediaStream([
        ...screenStream.getVideoTracks(),
        ...microphoneStream.getAudioTracks()
    ]);

    mediaRecorder = new MediaRecorder(combinedStream);

    mediaRecorder.ondataavailable = function(event) {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = function() {
        if (recordedChunks.length > 0) {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            downloadLink.href = url;
            downloadLink.download = 'screen-recording.mp4'; 
            downloadLink.style.display = 'block';
        } else {
            alert('لا توجد بيانات لتسجيل الفيديو.');
        }
    };

    mediaRecorder.start();
    startBtn.disabled = true;
    stopBtn.disabled = false;
}

stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
});

// تشغيل المعاينة عند تحميل الصفحة
window.onload = startPreview;
