/* LearnSphere - Google Cloud, Section 16: AI and Machine Learning Essentials.
   Lectures 0-4 are core. Needs gcp-common.js. */
(function(){
const K=window.GC,L=window.LESSONS;

const layers=K.dg(700,310,[
[10,10,680,290,'Choose the highest layer that solves the problem',1],
[30,45,640,50,'Applications: Gemini in Workspace and Google Cloud, Agent Builder, Contact Center AI',0],
[30,110,640,50,'Pre-trained APIs: Vision, Speech, Natural Language, Translation, Document AI',2],
[30,175,640,50,'Vertex AI: Gemini and other foundation models, AutoML, custom training, endpoints',2],
[30,240,640,45,'Infrastructure: GPUs, TPUs, Compute Engine, GKE, storage',0]],
[]);

const flow=K.dg(700,200,[
[10,10,680,180,'Machine learning lifecycle on Vertex AI',1],
[20,70,100,60,'Data|BigQuery, GCS',0],[140,70,100,60,'Train|models',2],[260,70,100,60,'Evaluate|metrics',0],[380,70,100,60,'Register|Model Registry',0],[500,70,170,60,'Serve|endpoint or batch',2]],
[[120,100,140,100],[240,100,260,100],[360,100,380,100],[480,100,500,100]]);

const rag=K.dg(700,230,[
[10,10,680,210,'Grounding a model in your data (RAG)',1],
[25,80,100,60,'User|question',0],[155,80,110,60,'Search or|vector index',2],[295,80,110,60,'Relevant|passages',0],[435,80,110,60,'Gemini|prompt, context',2],[575,80,95,60,'Answer|with sources',0]],
[[125,110,155,110],[265,110,295,110],[405,110,435,110],[545,110,575,110]]);

/* ---------- 0 ---------- */
L['gcp:15:0']={blocks:[
{p:'Google Cloud offers AI at several layers. You do not need to train a model to use AI: many tasks are solved by calling a ready-made API or a foundation model. The skill is choosing the right layer.'},
{svg:layers},
{h:'The layers'},
{t:[['Layer','What it is','Example use','Effort'],
['Pre-trained APIs','Ready-to-call models for a task','Read text from images, transcribe audio, translate','Lowest. Call an API'],
['Foundation models (Gemini)','General models for text, images, audio, video and code','Summarize, chat, classify, extract, generate','Low. Write prompts, add your data'],
['Vertex AI AutoML and custom training','Train models on your data','Predict churn, classify your product images','Medium to high'],
['Infrastructure','GPUs, TPUs and ML frameworks','Train large models','Highest']]},
{h:'Key products'},
{ul:['**Vertex AI**: the unified platform for building, deploying and managing models, including generative AI.','**Gemini**: Google\'s family of multimodal models, available through Vertex AI and other products.','**Model Garden**: a catalog of Google, partner and open models you can use or deploy.','**BigQuery ML**: build models with SQL where the data already lives.','**Document AI, Vision, Speech, Natural Language, Translation**: task-specific APIs.','**Agent Builder**: tools to build search and agent applications on your data.']},
{h:'How to choose'},
{flow:['Define the task and how success is measured','Can a pre-trained API do it? Use it','Is it language, reasoning or content generation? Try Gemini with a good prompt','Does it need your own data for accuracy? Add grounding or tune','Only then consider training a custom model']},
{note:'AI products and model names change quickly. Use the Model Garden and documentation to see the current model IDs and capabilities before designing.'}],
src:[['Google Cloud AI','https://cloud.google.com/products/ai'],['Vertex AI','https://cloud.google.com/vertex-ai/docs/start/introduction-unified-platform']]};

/* ---------- 1 ---------- */
L['gcp:15:1']={blocks:[
{p:'**Vertex AI** is Google Cloud\'s managed machine learning platform. It covers the whole lifecycle from data to a served model, with tools for both low-code and custom approaches.'},
{svg:flow},
{h:'Components'},
{t:[['Component','Purpose'],
['Workbench','Managed JupyterLab notebooks for exploration and training code'],
['Training','AutoML (no code) or custom training with your container on CPU, GPU or TPU'],
['Pipelines','Orchestrate repeatable ML workflows (Kubeflow Pipelines, TFX)'],
['Experiments and Metadata','Track runs, parameters and metrics'],
['Model Registry','Version and manage models'],
['Endpoints (online prediction)','Low-latency HTTPS serving, autoscaled'],
['Batch prediction','Score large datasets offline'],
['Feature Store','Store and serve features consistently for training and serving'],
['Vector Search','Similarity search over embeddings'],
['Model Monitoring','Detect drift and skew']]},
{h:'Example: deploy a model'},
{code:`gcloud ai models upload --region=us-central1 --display-name=churn-model --container-image-uri=us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-5:latest --artifact-uri=gs://my-bucket/model/
gcloud ai endpoints create --region=us-central1 --display-name=churn-endpoint
gcloud ai endpoints deploy-model ENDPOINT_ID --region=us-central1 --model=MODEL_ID --display-name=churn-v1 --machine-type=n1-standard-2 --min-replica-count=1 --max-replica-count=3
gcloud ai endpoints predict ENDPOINT_ID --region=us-central1 --json-request=request.json`},
{h:'Training choices'},
{t:[['Approach','Use when'],
['AutoML','Standard data types and you want a good model with little code'],
['Custom training','You have your own code and frameworks (TensorFlow, PyTorch, JAX, scikit-learn)'],
['BigQuery ML','Data is in BigQuery and SQL is enough'],
['Pre-trained plus tuning','A foundation model fits with a bit of customization']]},
{h:'Operations'},
{ul:['Use **endpoints with autoscaling** and set minimum replicas to avoid cold starts or cost.','Monitor prediction latency, errors and data drift.','Keep training data, code and models versioned.','Use service accounts with least privilege and private networking (Private Service Connect) for sensitive endpoints.']},
{note:'GPU and TPU capacity can be limited and costly. Check quotas early and shut down notebooks and endpoints you are not using.'}],
src:[['Vertex AI documentation','https://cloud.google.com/vertex-ai/docs'],['Model deployment','https://cloud.google.com/vertex-ai/docs/predictions/overview']]};

/* ---------- 2 ---------- */
L['gcp:15:2']={blocks:[
{p:'**Generative AI** models create text, images, code and other content from prompts. On Google Cloud, you use **Gemini** and other foundation models through Vertex AI, with enterprise controls for security, privacy and governance.'},
{h:'What Gemini can do'},
{ul:['Understand and generate text and code.','Work with **multimodal** input: images, audio, video and documents.','Follow instructions, summarize, extract data as JSON, classify and translate.','Call tools and functions to take actions or fetch data.','Use long context for large documents.']},
{h:'Calling a model'},
{code:`# pip install google-genai
from google import genai
client = genai.Client(vertexai=True, project="my-project", location="us-central1")
resp = client.models.generate_content(
    model="MODEL_ID",     # choose a current Gemini model from Model Garden
    contents="Summarize this support ticket in two sentences: ...",
)
print(resp.text)`},
{h:'Good prompts'},
{ul:['State the **role, task, format and constraints** clearly.','Give **examples** (few-shot) of the output you want.','Ask for **structured output** such as JSON with a schema.','Provide the **context** the model needs. Do not assume it knows your data.','Test with a set of real cases and measure results.']},
{h:'Grounding and RAG'},
{svg:rag},
{p:'Models can be wrong or out of date. **Grounding** connects the model to trusted sources: Google Search, your documents through **Vertex AI Search**, or a **RAG** (retrieval-augmented generation) pipeline with a vector index. The answer then cites real data, which reduces hallucination.'},
{h:'Controls'},
{t:[['Control','Use'],
['Safety settings','Filter harmful content categories'],
['System instructions','Set behaviour and tone'],
['Temperature and top-p','Tune randomness'],
['Context caching','Reuse large repeated context at lower cost'],
['Model Armor','Screen prompts and responses for prompt injection and data leaks'],
['Tuning','Adapt a model to your task with examples']]},
{note:'Pricing is mainly per token (input and output). Large prompts, long outputs and repeated calls add up, so measure and cache.'}],
src:[['Generative AI on Vertex AI','https://cloud.google.com/vertex-ai/generative-ai/docs/overview'],['Grounding','https://cloud.google.com/vertex-ai/generative-ai/docs/grounding/overview']]};

/* ---------- 3 ---------- */
L['gcp:15:3']={blocks:[
{p:'For common tasks you can skip model building and call a **pre-trained API**. Google trains and maintains these models, and you pay per use.'},
{t:[['API','What it does','Examples'],
['Vision AI','Image analysis: labels, text (OCR), faces, objects, safe-search','Tag product photos, read signs'],
['Speech-to-Text','Transcribe audio, with streaming and diarization','Call transcripts, captions'],
['Text-to-Speech','Natural voices from text','Voice assistants, audiobooks'],
['Natural Language','Entities, sentiment, syntax and classification','Analyze reviews'],
['Translation','Translate between many languages','Localize content'],
['Video Intelligence','Detect labels, shots and objects in video','Content moderation'],
['Document AI','Extract structured data from invoices, receipts, forms and IDs','Automate paperwork']]},
{code:`gcloud services enable vision.googleapis.com
gcloud ml vision detect-text gs://my-bucket/receipt.jpg
gcloud ml language analyze-sentiment --content="The delivery was fast and the product is great"
gcloud ml translate translate-text --content="Hello" --target-language=fr
gcloud ml speech recognize gs://my-bucket/call.wav --language-code=en-US`},
{h:'Document AI in a flow'},
{flow:['A scanned invoice lands in Cloud Storage','An Eventarc trigger starts a Cloud Run service','The service calls a Document AI processor','Extracted fields (vendor, total, dates) are validated','Results are written to BigQuery or sent to a finance system']},
{h:'When to use pre-trained APIs'},
{ul:['The task is standard and accuracy is adequate out of the box.','You want results quickly with no training data.','You can accept the cost per call at your volume.']},
{h:'When not'},
{ul:['Your domain is very specific and generic accuracy is too low (consider tuning or custom training).','Data cannot leave a region or boundary (check regional endpoints and data residency).','Volume is so large that self-hosted models would be cheaper.']},
{note:'Gemini can now do many of these tasks (OCR, sentiment, translation) with a prompt. Compare cost, accuracy and latency for your case.'}],
src:[['Vision AI','https://cloud.google.com/vision/docs'],['Document AI','https://cloud.google.com/document-ai/docs/overview'],['Speech-to-Text','https://cloud.google.com/speech-to-text/docs']]};

/* ---------- 4 ---------- */
L['gcp:15:4']={blocks:[
{p:'AI systems bring risks beyond normal software: biased or wrong outputs, leaked data, runaway cost and misuse. Plan for these from the start.'},
{h:'Responsible AI practices'},
{ul:['Define the **purpose** and who could be harmed if the system errs.','Test for **bias, safety and accuracy** with representative data, including edge cases.','Keep a **human in the loop** for high-impact decisions.','Be transparent: tell users when AI is used and its limits.','Monitor outputs in production and collect feedback.']},
{h:'Data and security'},
{t:[['Concern','Control'],
['Who sees prompts and data','Google Cloud states customer data is not used to train models without permission; check the data governance documentation'],
['Data location','Choose regional endpoints and organization policies for locations'],
['Access','IAM roles for Vertex AI, service accounts, private connectivity'],
['Exfiltration','VPC Service Controls support Vertex AI'],
['Encryption','Google-managed or CMEK for datasets, models and endpoints'],
['Prompt injection and leaks','Model Armor, input and output filters, least-privilege tools'],
['Audit','Cloud Audit Logs for AI services']]},
{h:'Cost control'},
{ul:['Set **budgets and alerts** for AI projects. Costs scale with tokens, GPUs and endpoint hours.','Use smaller or faster models where quality is enough.','Cache repeated context and responses.','Stop idle notebooks and delete unused endpoints.','Request quotas for GPUs and TPUs early, and choose regions with capacity.']},
{h:'Operating AI in production'},
{flow:['Evaluate with a fixed test set before release','Release gradually behind a flag','Log inputs and outputs safely with privacy in mind','Monitor quality, drift, latency and cost','Review and improve prompts or models on a schedule']},
{note:'Treat model output as untrusted input. Validate it before using it to run commands, queries or actions.'}],
src:[['Responsible AI','https://cloud.google.com/responsible-ai'],['Vertex AI security and governance','https://cloud.google.com/vertex-ai/docs/general/vertexai-security-controls']]};
})();
