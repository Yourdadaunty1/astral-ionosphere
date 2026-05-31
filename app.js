/**
 * ASTRAL IONOSPHERE - CELESTIAL FREQUENCY SYNTHESIZER & TELEMETRY
 * Real-time Web Audio synthesis & HTML5 Canvas wave propagation physics simulation.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let audioCtx = null;
    let isPlaying = false;
    let mainOscNode = null;
    let noiseFilterNode = null;
    let noiseGainNode = null;
    let mainGainNode = null;
    let masterAnalyser = null;
    let currentLayer = 'f'; // 'd', 'e', or 'f'
    let currentStellar = 'sun'; // 'sun', 'moon', 'jupiter', 'pulsar'

    // Parameters mapped from sliders
    let frequencyMHz = 14.2;
    let qFactor = 4.5;
    let ionizationNe = 1.5; // electron density factor

    // Waves visualizer elements
    const canvas = document.getElementById('canvas-waves');
    const ctx = canvas.getContext('2d');
    let canvasWidth = 0;
    let canvasHeight = 0;

    // Mini Spectrogram Elements
    const miniCanvas = document.getElementById('canvas-mini-fft');
    const miniCtx = miniCanvas.getContext('2d');

    // UI Element Selections
    const btnAudioToggle = document.getElementById('btn-audio-toggle');
    const sliderFreq = document.getElementById('slider-freq');
    const valFreq = document.getElementById('val-freq');
    const sliderResonance = document.getElementById('slider-resonance');
    const valResonance = document.getElementById('val-resonance');
    const sliderIonization = document.getElementById('slider-ionization');
    const valIonization = document.getElementById('val-ionization');
    const terminalBody = document.getElementById('terminal-body');
    const btnClearTerm = document.getElementById('btn-clear-term');

    // Live Header Stats
    const headerTime = document.getElementById('telemetry-time').querySelector('.value');
    const solarWindVal = document.getElementById('solar-wind-val');
    const fluxIndexVal = document.getElementById('flux-index-val');

    // Layer stats elements
    const statAlt = document.getElementById('stat-alt');
    const statFo = document.getElementById('stat-fo');
    const statRi = document.getElementById('stat-ri');

    // Signal bars
    const barSnr = document.getElementById('bar-snr');
    const valSnr = document.getElementById('val-snr');
    const barProp = document.getElementById('bar-prop');
    const valProp = document.getElementById('val-prop');
    const barFade = document.getElementById('bar-fade');
    const valFade = document.getElementById('val-fade');

    // --- Web Audio Synthesis Initialization & Controls ---
    function initAudio() {
        // Create audio context
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 1. Master Analyser
        masterAnalyser = audioCtx.createAnalyser();
        masterAnalyser.fftSize = 128;
        
        // 2. Main Gain
        mainGainNode = audioCtx.createGain();
        mainGainNode.gain.value = 0.0; // Start muted

        // 3. Main Oscillator (the celestial tone)
        mainOscNode = audioCtx.createOscillator();
        mainOscNode.type = 'sine'; // Sun defaults to sine
        mainOscNode.frequency.setValueAtTime(frequencyMHzToHz(frequencyMHz), audioCtx.currentTime);
        
        // 4. Bandpass / Resonant Lowpass Filter for frequency sweep
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, audioCtx.currentTime);
        filter.Q.setValueAtTime(qFactor, audioCtx.currentTime);

        // 5. White Noise Generator (Simulating celestial static / ionospheric hiss)
        const bufferSize = 2 * audioCtx.sampleRate;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        noiseSource.loop = true;

        // Dynamic bandpass filter for the noise
        noiseFilterNode = audioCtx.createBiquadFilter();
        noiseFilterNode.type = 'bandpass';
        noiseFilterNode.frequency.setValueAtTime(300, audioCtx.currentTime);
        noiseFilterNode.Q.setValueAtTime(2.0, audioCtx.currentTime);

        noiseGainNode = audioCtx.createGain();
        noiseGainNode.gain.setValueAtTime(0.08 * ionizationNe, audioCtx.currentTime); // controlled by ionization density

        // Connect noise pipeline
        noiseSource.connect(noiseFilterNode);
        noiseFilterNode.connect(noiseGainNode);
        noiseGainNode.connect(mainGainNode);

        // Connect oscillator pipeline
        mainOscNode.connect(filter);
        filter.connect(mainGainNode);

        // Connect master
        mainGainNode.connect(masterAnalyser);
        masterAnalyser.connect(audioCtx.destination);

        // Start sound sources
        mainOscNode.start();
        noiseSource.start();

        logTerminal('SYSTEM', 'Acoustic Synthesizer Pipeline established successfully.', 'success-line');
    }

    function frequencyMHzToHz(mhz) {
        // Map HF frequency (3MHz-30MHz) to an audible frequency scale (100Hz - 1200Hz)
        const normalized = (mhz - 3) / (30 - 3); // 0 to 1
        return 120 + normalized * 880;
    }

    function updateAudioParameters() {
        if (!audioCtx) return;

        // Apply carrier frequency mapping
        const targetHz = frequencyMHzToHz(frequencyMHz);
        mainOscNode.frequency.setTargetAtTime(targetHz, audioCtx.currentTime, 0.1);

        // Map ionization level to white noise gain and highpass/bandpass frequency shifts
        noiseGainNode.gain.setTargetAtTime(0.05 * ionizationNe, audioCtx.currentTime, 0.15);
        noiseFilterNode.frequency.setTargetAtTime(200 + (ionizationNe * 250), audioCtx.currentTime, 0.2);

        // Map Q-Factor to the main filter Q
        // We'll also connect Q-factor to sub-modulation rates for lunar or pulsar waves
        logTerminal('AUDIO', `Oscillator tuned: ${targetHz.toFixed(1)} Hz | Noise filter center: ${(200 + ionizationNe * 250).toFixed(0)} Hz`, 'system-line');
    }

    function applyStellarSoundscape() {
        if (!audioCtx) return;
        
        switch (currentStellar) {
            case 'sun':
                mainOscNode.type = 'sine';
                logTerminal('STELLAR', 'Solar Flux synthesis: Pure sine carrier, high stability.', 'success-line');
                break;
            case 'moon':
                mainOscNode.type = 'triangle';
                // Deeper tone for moon
                logTerminal('STELLAR', 'Lunar Tide synthesis: Smooth triangle carrier, subtle phasing.', 'info-line');
                break;
            case 'jupiter':
                mainOscNode.type = 'sawtooth';
                logTerminal('STELLAR', 'Jovian Decal synthesis: Rich harmonic sawtooth wave.', 'warning-line');
                break;
            case 'pulsar':
                mainOscNode.type = 'square';
                // Trigger interval pulsing in update audio parameter (handled below in render loop or timers)
                logTerminal('STELLAR', 'Pulsar PSR B1919 synthesis: Harmonic square wave, high-rate impulse modulation.', 'success-line');
                break;
        }
        updateAudioParameters();
    }

    // --- Interactive Wave Simulation & Rendering ---
    
    // Wave pulses injected by user clicking/dragging
    const activeRadioWaves = [];

    class RadioWavePulse {
        constructor(x, frequency) {
            this.x = x;
            this.y = canvasHeight; // starts at ground
            this.frequency = frequency;
            this.speed = 3.5 + (30 - frequency) * 0.15; // lower frequency is slightly slower, reflects more
            this.amplitude = 15 + Math.random() * 10;
            this.phase = 0;
            this.refracted = false;
            this.opacity = 1.0;
            this.size = 2;
            this.color = frequency > 15 ? '66, 252, 241' : '168, 127, 251';
        }

        update() {
            // Wave propagation physics
            this.y -= this.speed;
            this.phase += 0.2;

            // Target reflection/refraction layers based on Layer settings
            let targetAlt = canvasHeight * 0.7; // D-layer default height ratio
            if (currentLayer === 'e') targetAlt = canvasHeight * 0.45;
            if (currentLayer === 'f') targetAlt = canvasHeight * 0.2;

            // Simulate refraction/reflection based on frequency & electron density
            if (this.y <= targetAlt && !this.refracted) {
                // If frequency is too high, it pierces through the ionosphere and escapes into space!
                // Critical frequency fc is proportional to sqrt(electron density)
                const fc = 9.0 * Math.sqrt(ionizationNe);
                
                if (this.frequency > fc * (currentLayer === 'd' ? 0.6 : (currentLayer === 'e' ? 0.9 : 1.4))) {
                    // Pierces through the layer! Continues upward with reduced amplitude
                    this.refracted = true;
                    this.speed *= 1.1; // moves slightly faster in space
                    this.amplitude *= 0.4; // diminished signal strength
                    logTerminal('PROPAGATION', `Signal pierced layer (${this.frequency.toFixed(1)}MHz > fc). Escaping to deep orbit.`, 'warning-line');
                } else {
                    // Reflects back to earth!
                    this.refracted = true;
                    this.speed = -this.speed; // invert direction to travel back down
                    logTerminal('PROPAGATION', `Signal reflected by ${currentLayer.toUpperCase()}-Layer. Bouncing to ground station.`, 'success-line');
                }
            }

            // Fade out as it approaches the ground or outer space
            if (this.y > canvasHeight || this.y < 0) {
                this.opacity -= 0.04;
            }
        }

        draw() {
            ctx.save();
            ctx.beginPath();
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgba(${this.color}, ${this.opacity})`;
            
            // Draw sinusoidal wave path rather than just a dot
            ctx.strokeStyle = `rgba(${this.color}, ${this.opacity})`;
            ctx.lineWidth = 1.5;
            
            ctx.moveTo(this.x, this.y);
            const waveLength = 40;
            const sineOffset = Math.sin(this.phase) * this.amplitude;
            ctx.quadraticCurveTo(this.x + sineOffset, this.y + (this.speed > 0 ? 10 : -10), this.x, this.y + (this.speed > 0 ? 20 : -20));
            ctx.stroke();

            // Core dot
            ctx.beginPath();
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.arc(this.x + sineOffset, this.y, 3, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    // Dynamic layer wave animation background
    let timeIndex = 0;
    function renderWaves() {
        timeIndex += 0.01;
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // 1. Draw Earth Ground Line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(102, 252, 241, 0.25)';
        ctx.lineWidth = 2;
        ctx.moveTo(0, canvasHeight - 2);
        ctx.lineTo(canvasWidth, canvasHeight - 2);
        ctx.stroke();

        // 2. Draw Ionospheric Atmospheric Layers
        // Layer altitude boundaries
        const dLayerY = canvasHeight * 0.7;
        const eLayerY = canvasHeight * 0.45;
        const fLayerY = canvasHeight * 0.2;

        drawAtmosphericBand(dLayerY, 'D-LAYER (75km)', 'rgba(255, 184, 108, ', currentLayer === 'd');
        drawAtmosphericBand(eLayerY, 'E-LAYER (110km)', 'rgba(168, 127, 251, ', currentLayer === 'e');
        drawAtmosphericBand(fLayerY, 'F-LAYER (250km)', 'rgba(102, 252, 241, ', currentLayer === 'f');

        // 3. Update & Draw Active Radio Wave Pulses
        for (let i = activeRadioWaves.length - 1; i >= 0; i--) {
            const pulse = activeRadioWaves[i];
            pulse.update();
            pulse.draw();
            
            // Remove dead pulses
            if (pulse.opacity <= 0) {
                activeRadioWaves.splice(i, 1);
            }
        }

        // Auto-inject random celestial signals once in a while
        if (Math.random() < 0.015) {
            injectCelestialSignal();
        }

        requestAnimationFrame(renderWaves);
    }

    function drawAtmosphericBand(y, name, rgbaPrefix, isActive) {
        ctx.save();
        // Layer glowing container
        const gradient = ctx.createLinearGradient(0, y - 20, 0, y + 20);
        const opacityBase = isActive ? 0.12 : 0.03;
        gradient.addColorStop(0, `${rgbaPrefix}0)`);
        gradient.addColorStop(0.5, `${rgbaPrefix}${opacityBase})`);
        gradient.addColorStop(1, `${rgbaPrefix}0)`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, y - 20, canvasWidth, 40);

        // Layer center line
        ctx.strokeStyle = isActive ? `${rgbaPrefix}0.4)` : `${rgbaPrefix}0.1)`;
        ctx.lineWidth = isActive ? 1.5 : 0.5;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();

        // Wave oscillations in the layer representing charge/ion clouds
        ctx.strokeStyle = isActive ? `${rgbaPrefix}0.25)` : `${rgbaPrefix}0.05)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let x = 0; x < canvasWidth; x += 5) {
            const waveOffset = Math.sin(x * 0.03 + timeIndex * 3 + (isActive ? 2 : 0)) * (isActive ? 8 : 3);
            if (x === 0) ctx.moveTo(x, y + waveOffset);
            else ctx.lineTo(x, y + waveOffset);
        }
        ctx.stroke();

        // Label
        ctx.fillStyle = isActive ? '#ffffff' : 'rgba(226, 232, 240, 0.25)';
        ctx.font = '9px "Share Tech Mono"';
        ctx.fillText(name, 15, y - 6);

        ctx.restore();
    }

    function injectCelestialSignal() {
        const xPos = Math.random() * canvasWidth;
        activeRadioWaves.push(new RadioWavePulse(xPos, frequencyMHz));
    }

    // --- Mini FFT Spectrogram Visualizer ---
    function renderSpectrogram() {
        requestAnimationFrame(renderSpectrogram);

        const bufferLength = masterAnalyser ? masterAnalyser.frequencyBinCount : 64;
        const dataArray = new Uint8Array(bufferLength);

        if (isPlaying && masterAnalyser) {
            masterAnalyser.getByteFrequencyData(dataArray);
        } else {
            // Draw dummy low background noise if off
            for (let i = 0; i < bufferLength; i++) {
                dataArray[i] = Math.max(0, 10 + Math.sin(i * 0.2 + Date.now() * 0.005) * 5 + Math.random() * 4);
            }
        }

        miniCtx.fillStyle = '#070913';
        miniCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

        // Draw bar-spectrogram
        const barWidth = (miniCanvas.width / bufferLength) * 1.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * miniCanvas.height * 0.95;

            // Gradient based on selected source color
            let color = '#66fcf1'; // sun
            if (currentStellar === 'moon') color = '#a87ffb';
            if (currentStellar === 'jupiter') color = '#ffb86c';
            if (currentStellar === 'pulsar') color = '#50fa7b';

            miniCtx.fillStyle = color;
            miniCtx.fillRect(x, miniCanvas.height - barHeight, barWidth - 1, barHeight);

            x += barWidth;
        }
    }

    // --- Core UI Listeners & Telemetry Decoders ---
    
    // Resize canvases to parent elements
    function handleResize() {
        const wrap = document.getElementById('canvas-wrapper');
        canvasWidth = wrap.clientWidth;
        canvasHeight = wrap.clientHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        miniCanvas.width = miniCanvas.parentElement.clientWidth;
        miniCanvas.height = miniCanvas.parentElement.clientHeight;
    }
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    // Canvas click triggers a wave pulse manually
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        activeRadioWaves.push(new RadioWavePulse(clickX, frequencyMHz));
        
        // Add visual tap burst
        logTerminal('DECODE', `Manual wave injection at coordinate X:${clickX.toFixed(0)}px. Staging propagation.`, 'success-line');
    });

    // Sound toggle listener
    btnAudioToggle.addEventListener('click', () => {
        if (!isPlaying) {
            if (!audioCtx) {
                initAudio();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            // Ramp up volume
            mainGainNode.gain.setTargetAtTime(0.18, audioCtx.currentTime, 0.1);
            isPlaying = true;
            btnAudioToggle.classList.add('active');
            btnAudioToggle.querySelector('.btn-text').innerText = 'DAMPEN ATMOSPHERE';
            logTerminal('SYSTEM', 'Cosmic Carrier wave online. Tuning stellar filters.', 'success-line');
            updateAudioParameters();
        } else {
            // Mute volume
            mainGainNode.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.05);
            isPlaying = false;
            btnAudioToggle.classList.remove('active');
            btnAudioToggle.querySelector('.btn-text').innerText = 'INITIALIZE AUDIO SCAPE';
            logTerminal('SYSTEM', 'Atmospheric synthesis suspended. Carrier wave terminated.', 'warning-line');
        }
    });

    // Slider inputs
    sliderFreq.addEventListener('input', (e) => {
        frequencyMHz = parseFloat(e.target.value);
        valFreq.innerText = `${frequencyMHz.toFixed(1)} MHz`;
        updateAudioParameters();
        updateDynamicMetrics();
    });

    sliderResonance.addEventListener('input', (e) => {
        qFactor = parseFloat(e.target.value);
        valResonance.innerText = qFactor.toFixed(1);
        updateAudioParameters();
    });

    sliderIonization.addEventListener('input', (e) => {
        ionizationNe = parseFloat(e.target.value);
        valIonization.innerText = `${ionizationNe.toFixed(2)}e6 cm⁻³`;
        updateAudioParameters();
        updateDynamicMetrics();
    });

    // Clear Terminal button
    btnClearTerm.addEventListener('click', () => {
        terminalBody.innerHTML = '<div class="term-line system-line">[SYSTEM] Console buffer cleared. Listening...</div>';
    });

    // Stellar Selection Grid
    document.querySelectorAll('.stellar-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.stellar-btn').forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');
            currentStellar = targetBtn.dataset.source;
            
            applyStellarSoundscape();
        });
    });

    // Layer Selector Tabs
    document.querySelectorAll('.layer-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            document.querySelectorAll('.layer-tab').forEach(t => t.classList.remove('active'));
            const targetTab = e.currentTarget;
            targetTab.classList.add('active');
            currentLayer = targetTab.dataset.layer;

            // Update layer metrics
            updateLayerStats();
            updateDynamicMetrics();
        });
    });

    // Log lines to simulated retro console
    function logTerminal(system, msg, type = 'system-line') {
        const line = document.createElement('div');
        line.className = `term-line ${type}`;
        line.innerText = `[${system}] ${msg}`;
        
        terminalBody.appendChild(line);
        
        // Keep scroll container locked to bottom
        terminalBody.scrollTop = terminalBody.scrollHeight;

        // Prevent memory build up
        if (terminalBody.childElementCount > 30) {
            terminalBody.removeChild(terminalBody.firstChild);
        }
    }

    function updateLayerStats() {
        let altText = '';
        let criticalF = '';
        let refractiveIndex = '';

        const baseNe = ionizationNe;
        if (currentLayer === 'd') {
            altText = '75 km (Absorb)';
            criticalF = `${(2.2 * Math.sqrt(baseNe)).toFixed(2)} MHz`;
            refractiveIndex = (0.95 - (baseNe * 0.04)).toFixed(3);
            logTerminal('IONO', 'D-Layer tuned. High absorption of waves below 3MHz.', 'info-line');
        } else if (currentLayer === 'e') {
            altText = '110 km (Medium)';
            criticalF = `${(4.8 * Math.sqrt(baseNe)).toFixed(2)} MHz`;
            refractiveIndex = (0.88 - (baseNe * 0.07)).toFixed(3);
            logTerminal('IONO', 'E-Layer active. Ideal for night propagation reflection.', 'info-line');
        } else if (currentLayer === 'f') {
            altText = '250 km (Refract)';
            criticalF = `${(9.2 * Math.sqrt(baseNe)).toFixed(2)} MHz`;
            refractiveIndex = (0.75 - (baseNe * 0.12)).toFixed(3);
            logTerminal('IONO', 'F-Layer active. Primary global shortwave reflective boundary.', 'success-line');
        }

        statAlt.innerText = altText;
        statFo.innerText = criticalF;
        statRi.innerText = refractiveIndex;
    }

    function updateDynamicMetrics() {
        // Calculate propagation telemetry values based on ionization & frequency
        // We'll update the decoder signal strengths
        const fc = 9.2 * Math.sqrt(ionizationNe);
        
        // Higher SNR if frequency is closer to optimal traffic frequency (85% of critical freq)
        const optFreq = fc * 1.1; 
        const distanceToOpt = Math.abs(frequencyMHz - optFreq);
        const snr = Math.max(2.4, 25.0 - (distanceToOpt * 1.2)).toFixed(1);
        
        // Reliability
        let reliability = 0;
        if (frequencyMHz > fc * 1.4) {
            // Escapes atmosphere, low reliability for ground bounce
            reliability = Math.max(5, Math.round(20 - (frequencyMHz - fc) * 2));
        } else {
            reliability = Math.round(95 - (distanceToOpt * 4));
        }
        reliability = Math.min(99, Math.max(8, reliability));

        // Fade index
        const fade = Math.max(0.4, (2.8 - (snr * 0.1)) + Math.random() * 0.4).toFixed(1);

        // Update UI
        valSnr.innerText = `${snr} dB`;
        barSnr.style.width = `${Math.min(100, (snr / 25) * 100)}%`;

        valProp.innerText = `${reliability}%`;
        barProp.style.width = `${reliability}%`;

        valFade.innerText = `${fade} dB`;
        barFade.style.width = `${Math.min(100, (fade / 5) * 100)}%`;
    }

    // --- Loop for Simulated Header Telemetry Updates ---
    function updateLiveTelemetryLoop() {
        // Live UTC time
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        headerTime.innerText = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;

        // Small fluctuations in solar wind speed
        const windBase = parseFloat(solarWindVal.innerText);
        const newWind = (windBase + (Math.random() * 4.0 - 2.0)).toFixed(1);
        solarWindVal.innerText = `${Math.max(380, Math.min(650, newWind))} km/s`;

        // Small fluctuations in solar flux index
        const fluxBase = parseFloat(fluxIndexVal.innerText);
        const newFlux = Math.round(fluxBase + (Math.random() * 2 - 1));
        fluxIndexVal.innerText = `${Math.max(110, Math.min(220, newFlux))} SFU`;

        // Occasionally log in console
        if (Math.random() < 0.15) {
            const events = [
                'Pulsed ionization density fluctuates due to solar winds.',
                'Multipath fading vectors registered.',
                'Telemetry sync payload matches local parity.',
                'Cosmic noise floor steady at -112 dBm.',
                'F2 layer ion peaks detected over equatorial path.'
            ];
            const randEv = events[Math.floor(Math.random() * events.length)];
            logTerminal('RECEIVER', randEv, 'info-line');
        }

        setTimeout(updateLiveTelemetryLoop, 2000);
    }

    // Initialize application logic loops
    updateLayerStats();
    updateDynamicMetrics();
    updateLiveTelemetryLoop();
    
    // Start canvas animations
    renderWaves();
    renderSpectrogram();
    
    logTerminal('SYSTEM', 'Ionosphere Visualizer & Signal receiver initialized. Click canvas to sweep signal.', 'system-line');
});
