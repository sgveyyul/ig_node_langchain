import { TextLoader } from "langchain/document_loaders/fs/text";

const { HuggingFaceInference } = require("langchain/llms/hf")

exports.loadFile = async(file) => {
    if(file.originalname.endsWith(".csv")) {
        const loader = new TextLoader("src/document_loaders/example_data/example.txt");
        const docs = await loader.load();
        return docs
    }
    
}