const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const GridFsStorage = require('multer-gridfs-storage');

const {url} = require('./settings');
/* eslint-disable-next-line new-cap */
const router = express.Router();

function generateName() {
	return new Promise((resolve, reject) => {
		crypto.randomBytes(16, (err, buf) => {
			if (err) {
				reject(err);
			}

			resolve(buf.toString('hex'));
		});
	});
}

const asyncStorage = new GridFsStorage({
	url,
	file: async () => {
		const random = await generateName();
		return `my_file_${random}`;
	}
});
const asyncUpload = multer({storage: asyncStorage});
router.post('/async', asyncUpload.single('field'), (req, res) => {
	res.status(201).send('File uploaded');
});

const promiseStorage = new GridFsStorage({
	url,
	file: () => {
		return generateName().then(random => {
			return `my_file_${random}`;
		});
	}
});
const promiseUpload = multer({storage: promiseStorage});
router.post('/promise', promiseUpload.single('field'), (req, res) => {
	res.status(201).send('File uploaded');
});

module.exports = router;
