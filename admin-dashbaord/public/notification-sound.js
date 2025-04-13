// Simple notification sound generator
// This script generates a notification sound using the Web Audio API
// Run this in a browser to download the sound file

function generateNotificationSound() {
  // Create audio context
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Create an offline context for rendering (1 second)
  const offlineContext = new OfflineAudioContext(2, audioContext.sampleRate * 1, audioContext.sampleRate);

  // Create oscillator for the notification sound
  const oscillator = offlineContext.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, 0); // A5
  oscillator.frequency.exponentialRampToValueAtTime(440, 0.1); // A4

  // Add a second tone
  const oscillator2 = offlineContext.createOscillator();
  oscillator2.type = "sine";
  oscillator2.frequency.setValueAtTime(587.33, 0.1); // D5
  oscillator2.frequency.exponentialRampToValueAtTime(659.25, 0.2); // E5

  // Create gain nodes for volume control
  const gainNode = offlineContext.createGain();
  gainNode.gain.setValueAtTime(0, 0);
  gainNode.gain.linearRampToValueAtTime(0.3, 0.05);
  gainNode.gain.exponentialRampToValueAtTime(0.01, 0.5);

  const gainNode2 = offlineContext.createGain();
  gainNode2.gain.setValueAtTime(0, 0.1);
  gainNode2.gain.linearRampToValueAtTime(0.3, 0.15);
  gainNode2.gain.exponentialRampToValueAtTime(0.01, 0.6);

  // Connect nodes
  oscillator.connect(gainNode);
  gainNode.connect(offlineContext.destination);

  oscillator2.connect(gainNode2);
  gainNode2.connect(offlineContext.destination);

  // Start oscillators
  oscillator.start(0);
  oscillator.stop(0.5);
  oscillator2.start(0.1);
  oscillator2.stop(0.6);

  // Update the button
  const button = document.getElementById('generateButton');
  button.textContent = 'Generating...';
  button.disabled = true;

  // Render the sound
  offlineContext.startRendering().then(function (renderedBuffer) {
    // Download the buffer as a WAV file
    const wavBlob = bufferToWave(renderedBuffer, offlineContext.length);
    const url = URL.createObjectURL(wavBlob);

    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = 'notification-sound.mp3';
    link.innerHTML = 'Download Notification Sound';
    link.className = 'download-link';
    link.style.display = 'block';
    link.style.marginTop = '15px';
    link.style.color = '#1976d2';

    // Update the download area
    const downloadArea = document.getElementById('downloadLink');
    downloadArea.innerHTML = '';
    downloadArea.appendChild(link);

    // Update button
    button.textContent = 'Generate Again';
    button.disabled = false;

    // Preview the sound
    const audioElement = new Audio(url);
    audioElement.play();

    // Add a preview button
    const previewButton = document.createElement('button');
    previewButton.textContent = 'Play Sound Again';
    previewButton.style.marginTop = '10px';
    previewButton.style.backgroundColor = '#4caf50';
    previewButton.addEventListener('click', () => {
      audioElement.currentTime = 0;
      audioElement.play();
    });
    downloadArea.appendChild(previewButton);

    // Add a success message
    const successMessage = document.createElement('p');
    successMessage.textContent = 'Sound generated successfully!';
    successMessage.style.color = '#4caf50';
    successMessage.style.marginTop = '10px';
    downloadArea.appendChild(successMessage);
  }).catch(function (err) {
    console.error('Error rendering sound:', err);
    button.textContent = 'Failed - Try Again';
    button.disabled = false;
  });
}

// Function to convert audio buffer to WAV format
function bufferToWave(abuffer, len) {
  const numOfChan = abuffer.numberOfChannels;
  const length = len * abuffer.sampleRate * numOfChan * 2 + 44;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  let pos = 0;

  // Write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * numOfChan * 2); // avg. bytes/sec
  setUint16(numOfChan * 2); // block align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data" chunk
  setUint32(length - pos - 4); // chunk length

  // Write interleaved data
  const channels = [];
  for (let i = 0; i < numOfChan; i++) {
    channels.push(abuffer.getChannelData(i));
  }

  let sample = 0;
  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      if (sample >= channels[i].length) break;
      let val = Math.max(-1, Math.min(1, channels[i][sample]));
      val = val < 0 ? val * 0x8000 : val * 0x7FFF;
      setInt16(val);
    }
    sample++;
  }

  return new Blob([buffer], { type: "audio/wav" });

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }

  function setInt16(data) {
    view.setInt16(pos, data, true);
    pos += 2;
  }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', function() {
  const button = document.getElementById('generateButton');
  if (button) {
    button.addEventListener('click', generateNotificationSound);
  } else {
    console.error('Generate button not found!');
  }
});
