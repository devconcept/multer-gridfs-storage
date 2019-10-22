const express = require('express');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');

const {url} = require('./settings');
/* eslint-disable-next-line new-cap */
const router = express.Router();
const {generateBytes} = GridFsStorage;

const genStorage = new GridFsStorage({
	url,
	options: {useNewUrlParser: true, useUnifiedTopology: true},
	async *file(req, file) {
		let counter = 0;
		for (;;) {
			/* eslint-disable-next-line no-await-in-loop */
			const {filename} = await generateBytes();
			[, file] = yield `${file.originalname}_${filename}_${counter}`;
			counter++;
		}
	}
});
const genUpload = multer({storage: genStorage});
router.post('/gen', genUpload.single('field'), (req, res) => {
	res.status(201).send('File uploaded');
});

module.exports = router;
