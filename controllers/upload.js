require('dotenv').config()

const { OpenAIEmbeddings } = require("@langchain/openai")
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { Document } = require("langchain/document")
const { PGVectorStore } = require("@langchain/community/vectorstores/pgvector");

const { Upload } = require("@aws-sdk/lib-storage")
const { s3 } = require('../config/aws')

const { pgVectorConfig } = require("../config/pgdb")

// upload file to s3 parallelly in chunks
exports.fileUpload = async (req, res) => {
	const file = req.file
	console.log(file)

	// params for s3 upload
	const params = {
		Bucket: process.env.S3_BUCKET_NAME,
		Key: `uploads/88/9999/${file.originalname}`,
		Body: file.buffer,
		// ACL: 'public-read'
	}
	try {
		// upload file to s3 parallelly in chunks
		// it supports min 5MB of file size
		const uploadParallel = new Upload({
			client: s3,
			queueSize: 4, // optional concurrency configuration
			partSize: 5542880, // optional size of each part
			leavePartsOnError: false, // optional manually handle dropped parts
			params,
		})
	
		// checking progress of upload
		uploadParallel.on("httpUploadProgress", progress => {
			console.log(progress)
		})
	
		// after completion of upload
		uploadParallel.done().then(async data => {
			// const uploadRes = await NSUpload.create(user.user_id, filename)
			const docs = await loadFile(file)
			const splitter = new RecursiveCharacterTextSplitter({
				chunkSize: 500,
				chunkOverlap: 20,
			});

			const splitDocs = await splitDocuments(docs, splitter)
			const embeddingsModel = new OpenAIEmbeddings({
				openAIApiKey: process.env.OPENAI_API_KEY, // In Node.js defaults to process.env.OPENAI_API_KEY
				batchSize: 512, // Default value if omitted is 512. Max is 2048
				modelName: "text-embedding-3-large",
				dimensions: 512
			});
			
			const pgvectorStore = new PGVectorStore(embeddingsModel, pgVectorConfig);

			for(var i in splitDocs) {
				for(var j in splitDocs[i]['chunks']) {
					// console.log(splitDocs[i]['chunks'][j])
					const chunkText = splitDocs[i]['chunks'][j]['pageContent'];
					const vectors = await embeddingsModel.embedDocuments([chunkText]);
					const vector = vectors[0];
					await pgvectorStore.addDocuments(vector)
					// console.log(vectors2[0]);
				}
			}

			return res.status(200).json({
				code: 0,
				message: 'File uploaded successfully.',
				date: new Date(),
				// data: uploadRes
			});
		})
		} catch (error) {
			res.send({
				success: false,
				message: error.message,
			})
		}
}

const loadFile = async(file) => {
	const doc = new Document({
		pageContent: file.buffer.toString('utf-8'),
		metadata: { source: file.originalname }
		
	})
	return doc
}

const splitDocuments = async(doc, splitter) => {
  const splitDocs = []; // This will store the split results

	const text = doc.pageContent;
	const chunks = await splitter.splitDocuments([
		new Document({ pageContent: text }),
	])
	if (text) {
		// Apply the splitter to each document's text
		const chunks = await splitter.splitDocuments([
			new Document({ pageContent: text }),
		]); 
		splitDocs.push({
			...doc, // Spread the original document properties
			chunks: chunks, // Add the split text chunks as a new property
		});
	} else {
		// If there is no text, you might want to handle this case differently
		// For now, just pushing the original doc
		splitDocs.push(doc);
	}

  return splitDocs; // Return the array with the documents and their split text
} 