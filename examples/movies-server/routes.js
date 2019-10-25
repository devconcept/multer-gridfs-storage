const express = require('express');
const multer = require('multer');
const {GridFSBucket, ObjectID} = require('mongodb');
const GridFsStorage = require('multer-gridfs-storage');

const {dbReady} = require('./connection');
const db = dbReady().then(client => client.db('examples'));
const client = dbReady();

/* eslint-disable-next-line new-cap */
const router = express.Router();
const storage = new GridFsStorage({db, client});
const upload = multer({storage});

router.post('/movie', upload.single('movie'), (req, res) => {
	res.status(201).send('File uploaded');
});

router.get('/movie/:id', (req, res) => {
	const bucket = new GridFSBucket(storage.db);
	const stream = bucket.openDownloadStream(new ObjectID(req.params.id));
	stream.on('error', err => {
		if (err.code === 'ENOENT') {
			res.status(404).send('File not found');
			return;
		}

		res.status(500).send(err.message);
	});
	stream.pipe(res);
});

router.delete('/movie/:id', (req, res) => {
	const bucket = new GridFSBucket(storage.db);
	bucket.delete(new ObjectID(req.params.id), err => {
		if (err) {
			if (err.message.startsWith('FileNotFound')) {
				res.status(404).send('File not found');
				return;
			}

			return res.status(500).send(err);
		}

		res.status(204).send('File deleted');
	});
});

module.exports = router;
