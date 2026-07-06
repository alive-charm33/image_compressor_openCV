document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:3005' : '';
  console.log('OptiSize initialized. API Base URL:', API_BASE || '(relative)');
  
  const uploadSection = document.getElementById('upload-section');
  const editorSection = document.getElementById('editor-section');
  const processingSection = document.getElementById('processing-section');
  const resultSection = document.getElementById('result-section');

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');

  const imagePreview = document.getElementById('image-preview');
  const originalResolutionBadge = document.getElementById('original-resolution-badge');
  const originalFilenameSpan = document.getElementById('original-filename');
  const originalSizeSpan = document.getElementById('original-size');

  const widthInput = document.getElementById('width-input');
  const heightInput = document.getElementById('height-input');
  const aspectLockBtn = document.getElementById('aspect-lock-btn');
  const presetButtons = document.querySelectorAll('.btn-preset');
  const formatRadios = document.querySelectorAll('input[name="format"]');
  const qualityGroup = document.getElementById('quality-group');
  const qualityInput = document.getElementById('quality-input');
  const qualityValue = document.getElementById('quality-value');
  const customScaleInput = document.getElementById('custom-scale-input');

  const resizeBtn = document.getElementById('resize-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const resetBtn = document.getElementById('reset-btn');

  const resultOriginalImg = document.getElementById('result-original-img');
  const resultResizedImg = document.getElementById('result-resized-img');
  const resOrigDimensions = document.getElementById('res-orig-dimensions');
  const resOrigSize = document.getElementById('res-orig-size');
  const resNewDimensions = document.getElementById('res-new-dimensions');
  const resNewSize = document.getElementById('res-new-size');
  const resSavings = document.getElementById('res-savings');
  const downloadLink = document.getElementById('download-link');

  // Application State
  let currentFile = {
    filename: '',
    originalName: '',
    size: 0,
    width: 0,
    height: 0,
    aspectRatio: 1,
    url: ''
  };

  let isLocked = true;
  let activePreset = 100;

  // Init
  updateLockState();
  toggleQualityVisibility();

  // Screen transition helper
  function showScreen(screen) {
    [uploadSection, editorSection, processingSection, resultSection].forEach(s => {
      s.classList.remove('active');
    });
    screen.classList.add('active');
  }

  // File size formatter helper
  function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // --- UPLOAD HANDLERS ---
  // Note: Entire drop-zone is covered by fileInput overlay, so click is handled natively.

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleUpload(e.target.files[0]);
    }
  });

  // Drag and Drop Events
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  });

  // Upload Logic
  async function handleUpload(file) {
    console.log('File selected for upload:', file.name, 'Mime type:', file.type, 'Size:', file.size, 'bytes');
    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Invalid file format. Please upload JPG, PNG, or WebP.');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    console.log('Transitioning to processing screen...');
    showScreen(processingSection);

    try {
      console.log('Sending upload fetch request...');
      const response = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      console.log('Upload response successfully parsed:', data);
      
      // Store state
      currentFile = {
        filename: data.filename,
        originalName: data.originalName,
        size: data.size,
        width: data.width,
        height: data.height,
        aspectRatio: data.width / data.height,
        url: data.url
      };

      // Update UI preview
      imagePreview.src = API_BASE + data.url;
      originalResolutionBadge.textContent = `${data.width} × ${data.height}`;
      originalFilenameSpan.textContent = data.originalName;
      originalSizeSpan.textContent = formatBytes(data.size);

      // Populate input dimensions
      widthInput.value = data.width;
      heightInput.value = data.height;

      // Reset preset buttons to 100%
      presetButtons.forEach(btn => btn.classList.remove('active'));
      document.querySelector('[data-scale="100"]').classList.add('active');
      customScaleInput.value = '';
      activePreset = 100;

      showScreen(editorSection);

    } catch (error) {
      console.error(error);
      alert('Error: ' + error.message);
      showScreen(uploadSection);
    }
  }

  // --- EDITOR HANDLERS ---

  // Aspect ratio lock button toggling
  aspectLockBtn.addEventListener('click', () => {
    isLocked = !isLocked;
    updateLockState();
  });

  function updateLockState() {
    if (isLocked) {
      aspectLockBtn.classList.add('locked');
      aspectLockBtn.querySelector('i').className = 'fa-solid fa-link lock-icon';
    } else {
      aspectLockBtn.classList.remove('locked');
      aspectLockBtn.querySelector('i').className = 'fa-solid fa-link-slash lock-icon';
    }
  }

  // Dimension changes calculation
  widthInput.addEventListener('input', () => {
    const val = parseInt(widthInput.value, 10);
    if (!isNaN(val) && isLocked && currentFile.aspectRatio) {
      heightInput.value = Math.round(val / currentFile.aspectRatio);
    }
    clearPresets();
  });

  heightInput.addEventListener('input', () => {
    const val = parseInt(heightInput.value, 10);
    if (!isNaN(val) && isLocked && currentFile.aspectRatio) {
      widthInput.value = Math.round(val * currentFile.aspectRatio);
    }
    clearPresets();
  });

  function clearPresets() {
    presetButtons.forEach(btn => btn.classList.remove('active'));
    customScaleInput.value = '';
    activePreset = null;
  }

  // Scale presets handlers
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      customScaleInput.value = '';
      
      const scale = parseInt(btn.dataset.scale, 10);
      activePreset = scale;

      if (currentFile.width && currentFile.height) {
        widthInput.value = Math.round(currentFile.width * (scale / 100));
        heightInput.value = Math.round(currentFile.height * (scale / 100));
      }
    });
  });

  // Custom scale manual typing handler
  customScaleInput.addEventListener('input', () => {
    const scale = parseInt(customScaleInput.value, 10);
    if (!isNaN(scale) && scale > 0) {
      presetButtons.forEach(b => b.classList.remove('active'));
      activePreset = scale;

      if (currentFile.width && currentFile.height) {
        widthInput.value = Math.round(currentFile.width * (scale / 100));
        heightInput.value = Math.round(currentFile.height * (scale / 100));
      }
    } else {
      activePreset = null;
    }
  });

  // Format Selection Visibility
  formatRadios.forEach(radio => {
    radio.addEventListener('change', toggleQualityVisibility);
  });

  function toggleQualityVisibility() {
    const activeFormat = document.querySelector('input[name="format"]:checked').value;
    if (activeFormat === 'jpeg' || activeFormat === 'png') {
      qualityGroup.classList.add('visible');
      if (activeFormat === 'png') {
        document.querySelector('#quality-group .slider-labels span:first-child').textContent = 'Larger file (Slow)';
        document.querySelector('#quality-group .slider-labels span:last-child').textContent = 'Smallest file (Fast)';
      } else {
        document.querySelector('#quality-group .slider-labels span:first-child').textContent = 'Smaller size';
        document.querySelector('#quality-group .slider-labels span:last-child').textContent = 'Best quality';
      }
    } else {
      qualityGroup.classList.remove('visible');
    }
  }

  qualityInput.addEventListener('input', () => {
    qualityValue.textContent = qualityInput.value + '%';
  });

  // Cancel sizing
  cancelBtn.addEventListener('click', () => {
    fileInput.value = '';
    customScaleInput.value = '';
    showScreen(uploadSection);
  });

  // Reset resizer
  resetBtn.addEventListener('click', () => {
    fileInput.value = '';
    customScaleInput.value = '';
    showScreen(uploadSection);
  });

  // --- RESIZE API SUBMISSION ---
  resizeBtn.addEventListener('click', async () => {
    const width = parseInt(widthInput.value, 10);
    const height = parseInt(heightInput.value, 10);
    
    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
      alert('Please enter valid positive dimensions for width and height.');
      return;
    }

    const formatVal = document.querySelector('input[name="format"]:checked').value;
    const format = formatVal === 'original' ? '' : formatVal;
    const quality = parseInt(qualityInput.value, 10);

    const payload = {
      filename: currentFile.filename,
      width,
      height,
      format,
      quality
    };

    console.log('Sending resize fetch request...', payload);

    try {
      const response = await fetch(`${API_BASE}/api/resize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Resizing execution failed');
      }

      const data = await response.json();
      console.log('Resize response successfully parsed:', data);

      // Update comparison screens
      resultOriginalImg.src = API_BASE + currentFile.url;
      resultResizedImg.src = API_BASE + data.url;

      resOrigDimensions.textContent = `${currentFile.width} × ${currentFile.height} px`;
      resOrigSize.textContent = formatBytes(currentFile.size);

      resNewDimensions.textContent = `${data.width} × ${data.height} px`;
      resNewSize.textContent = formatBytes(data.size);

      // Calc percentage savings
      const savingsPercent = Math.round(((currentFile.size - data.size) / currentFile.size) * 100);
      if (savingsPercent > 0) {
        resSavings.className = 'saving-badge';
        resSavings.textContent = `-${savingsPercent}%`;
      } else if (savingsPercent < 0) {
        resSavings.className = 'saving-badge warning-badge';
        resSavings.textContent = `+${Math.abs(savingsPercent)}%`;
      } else {
        resSavings.className = 'saving-badge';
        resSavings.textContent = '0%';
      }

      // Configure download route
      downloadLink.href = `${API_BASE}/download/${data.filename}`;
      
      showScreen(resultSection);

    } catch (error) {
      console.error(error);
      alert('Error during resizing: ' + error.message);
      showScreen(editorSection);
    }
  });
});
