const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

const PORT = 3000;
const apiKey = 'AIzaSyDOKW5n2dbwbt2E_gbI-08Io5K0aUlUYDA';

// Set up Google Generative AI client
const genAI = new GoogleGenerativeAI(apiKey);

// Set storage engine
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// Init upload
const upload = multer({
  storage: storage,
  // limits: { fileSize: 1000000 }, // limit file size to 1MB
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  }
}).fields([
  { name: 'images', maxCount: 2 } // Assuming you want to handle up to 2 files
]);

// Check file type
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Error: Images Only!'));

  }
}

// Set static folder
app.use(express.static('./public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.use(upload)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// Route to handle file upload
app.post('/upload', async (req, res) => {
  const askInput = req.body.askInput;
  // Log the incoming request body to check if files are being sent correctly

  if (!req.files || !req.files.images) {
    res.status(400).send('Error: No Images Selected!');
  } else {
    if (req.files.images.length < 1) {
      res.status(400).send('Error: Need to upload two images');
    }
    else {
      try {
        if (req.body.option === 'compare' && req.files.images.length !== 2) {
          res.status(400).send('Error: Need to upload two images for comparison');
        } else if (req.body.option === 'read') {
          if (req.files.images.length !== 1) {
            return res.status(400).send('Error: Need to upload one image for reading');
          }
          if (!askInput || askInput.trim() === '') {
            return res.status(400).send('Error: Please enter a question for reading the image.');
          }
          const result = await processFiles(req.files.images, askInput);
          res.status(200).send(`Result: ${result}`);
        }
        else {
          const result = await processFiles(req.files.images, askInput);
          res.status(200).send(`Result: ${result}`);

        }
      } catch (error) {
        console.error('Result:', error);
        res.status(500).send('Result : Error processing files');
      }
    }
  }

});

// Process uploaded files using Google Generative AI
async function processFiles(files, askInput) {
  // For text-and-image input (multimodal), use the gemini-pro-vision model
  const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

  const prompt = askInput ? askInput : 'Can you tell me the differences between the two picutures';
  const imageParts = files.map(fileToGenerativePart);
  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response;

  return response.text();
}

// Converts local file information to a GoogleGenerativeAI.Part object.
function fileToGenerativePart(file) {
  return {
    inlineData: {
      data: fs.readFileSync(file.path, { encoding: 'base64' }),
      mimeType: file.mimetype
    },
  };
}
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('Error: File size too large. Maximum allowed size is 5MB.');
    }
  } else if (err.message === 'Error: Images Only!') {
    return res.status(400).send('Error: Images Only!');
  }
  next(err);
});

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
