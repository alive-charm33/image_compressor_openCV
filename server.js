const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Create upload and output directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
if (!fs.existsSync(OUTPUTS_DIR)) {
  fs.mkdirSync(OUTPUTS_DIR);
}

// Serve uploads and outputs statically for preview
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/outputs', express.static(OUTPUTS_DIR));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'input-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  }
});

// Helper: Run python to get image dimensions
function getImageDimensions(filePath) {
  return new Promise((resolve, reject) => {
    // Escape path for windows shell if needed
    const escapedPath = filePath.replace(/\\/g, '\\\\');
    const cmd = `python -c "import cv2; img=cv2.imread(r'${escapedPath}'); print(f'{img.shape[1]},{img.shape[0]}')"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        return reject(error);
      }
      const parts = stdout.trim().split(',');
      if (parts.length === 2) {
        resolve({
          width: parseInt(parts[0], 10),
          height: parseInt(parts[1], 10)
        });
      } else {
        reject(new Error('Failed to parse dimensions'));
      }
    });
  });
}

// 1. Upload API
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const dimensions = await getImageDimensions(req.file.path);
    res.json({
      message: 'Upload successful',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      width: dimensions.width,
      height: dimensions.height,
      url: `/uploads/${req.file.filename}`
    });
  } catch (err) {
    console.error('Error getting image dimensions:', err);
    res.json({
      message: 'Upload successful (dimensions unavailable)',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      width: 0,
      height: 0,
      url: `/uploads/${req.file.filename}`
    });
  }
});

// 2. Resize API
app.post('/api/resize', (req, res) => {
  const { filename, width, height, format, quality } = req.body;

  if (!filename || !width || !height) {
    return res.status(400).json({ error: 'Missing required parameters: filename, width, height' });
  }

  const inputPath = path.join(UPLOADS_DIR, filename);
  if (!fs.existsSync(inputPath)) {
    return res.status(404).json({ error: 'Original image not found' });
  }

  // Determine output extension and filename
  const baseName = path.basename(filename, path.extname(filename));
  const outputExt = format ? `.${format}` : path.extname(filename);
  const outputFilename = `resized-${baseName}-${width}x${height}${outputExt}`;
  const outputPath = path.join(OUTPUTS_DIR, outputFilename);

  // Spawn Python script to do the work
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'resize.py'),
    inputPath,
    outputPath,
    width,
    height,
    quality || 90
  ]);

  let stderrData = '';
  pythonProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error(`Python script error code ${code}:`, stderrData);
      return res.status(500).json({ error: 'Failed to resize image using OpenCV', details: stderrData });
    }

    // Get size of output image
    try {
      const stats = fs.statSync(outputPath);
      res.json({
        message: 'Resizing successful',
        filename: outputFilename,
        size: stats.size,
        width: parseInt(width, 10),
        height: parseInt(height, 10),
        url: `/outputs/${outputFilename}`
      });
    } catch (err) {
      console.error('Error stating output file:', err);
      res.status(500).json({ error: 'Resizing succeeded, but output file metadata retrieval failed' });
    }
  });
});

// 3. Download API
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(OUTPUTS_DIR, filename);

  if (fs.existsSync(filePath)) {
    res.download(filePath, filename);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Error handler for Multer limits/errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
