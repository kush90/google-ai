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
    cb(null, file.originalname);
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

app.use(upload);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Route to handle file upload
app.post('/upload', async (req, res) => {
  const { askInput, askInputAnything, option } = req.body;

  try {
    let result;
    if (option === 'compare') {
      if (!req.files || !req.files.images) {
        return res.status(400).send({result:'Error: No Images Selected!'});
      }
      if (req.files.images.length !== 2) {
        return res.status(400).send({result:'Error: Need to upload exactly two images for comparison'});
      }
      result = await processFiles(req.files.images, askInput);
    } else if (option === 'read') {
      if (!req.files || !req.files.images) {
        return res.status(400).send({result:'Error: No Images Selected!'});
      }
      if (req.files.images.length !== 1) {
        return res.status(400).send({result:'Error: Need to upload one image for reading'});
      }
      if (!askInput || askInput.trim() === '') {
        return res.status(400).send({result:'Error: Please enter a question for reading the image.'});
      }
      result = await processFiles(req.files.images, askInput);
    } else if (option === 'ask') {
      if (!askInputAnything || askInputAnything.trim() === '') {
        return res.status(400).send({result:'Error: Please enter text you want to ask'});
      }
      result = await run(askInputAnything);
    } else {
      return res.status(400).send('Error: Invalid option selected');
    }

    return res.status(200).json({ result });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).send('Error processing files');
  }
});


// Process uploaded files using Google Generative AI
async function processFiles(files, askInput) {
  // For text-and-image input (multimodal), use the gemini-pro-vision model
  const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

  const prompt = askInput ? askInput : 'Can you tell me the differences between the two pictures';
  const imageParts = files.map(fileToGenerativePart);
  const result = await model.generateContent([prompt, ...imageParts]);
  const response = await result.response;

  return response.text();
}

async function run(askInputAnything) {
  // For text-only input, use the gemini-pro model
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent(askInputAnything);
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

app.post('/delete', (req, res) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).send('Error: No files specified for deletion.');
  }

  let deletePromises = files.map((filename) => {
    return new Promise((resolve, reject) => {
      const filePath = path.join(__dirname, 'uploads', filename);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });

  Promise.all(deletePromises)
    .then(() => res.status(200).send('Files deletion completed.'))
    .catch((err) => res.status(500).send('Error deleting files'));
});

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
