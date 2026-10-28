/* ============================================================
   AWS LESSONS, part 2: gen AI and machine learning on AWS
   Same format as js/aws-lessons-1.js.
   ============================================================ */

AWS_LESSONS.push({
  id: 'aws-genai', group: 'genai', title: 'Gen AI on AWS: Bedrock vs SageMaker vs Quick',
  question: 'How much of the AI stack do I want to own?',
  summary: 'AWS offers every level, from "buy" to "build". Amazon Quick is a finished assistant for employees. Bedrock gives your app top models through an API, plus RAG, guardrails, and agents. SageMaker AI is a lab for training and hosting your own models. EC2 GPUs and Trainium are the raw hardware. Purpose-built AI services (Textract, Transcribe…) beat LLMs at narrow perception tasks. Start as high up the ladder as you can.',
  services: ['bedrock', 'kb', 'agentcore', 'sagemaker', 'gpu', 'quick', 'textract'],
  decide: [
    ['Employees need an AI assistant over company docs and apps, with no app to build', ['quick'], 'Amazon Quick (it replaced Amazon Q Business). For AI coding help, AWS now points to Kiro.'],
    ['Add gen AI to your product using top models through an API', ['bedrock'], 'Chat, summarize, extract, classify. Pay per token. Most teams start and stay here.'],
    ['The model needs your documents', ['kb'], 'RAG with Knowledge Bases. See the RAG lesson.'],
    ['The AI must take actions with tools, not just answer', ['agentcore'], 'See the agents lesson.'],
    ['You need a custom or open model, classic ML, or full control of serving', ['sagemaker'], 'Train, fine-tune, and host on managed infrastructure.'],
    ['You are training large models or building your own AI platform', ['gpu'], 'Raw GPUs, Trainium, and Inferentia, often with EKS or SageMaker HyperPod.'],
    ['A well-defined perception task: OCR, speech-to-text, image moderation', ['textract', 'transcribe', 'rekognition'], 'Purpose-built AI services are often cheaper and more consistent than an LLM.']
  ],
  compare: {
    title: 'The build-vs-buy ladder',
    cols: ['quick', 'bedrock', 'sagemaker', 'gpu'],
    rows: [
      ['You get', ['A finished assistant', 'Models via API + RAG, guardrails, agents', 'Tools to train, tune, and host any model', 'Raw accelerated servers']],
      ['You manage', ['Settings and data connections', 'Prompts, data, app code', 'Data, training code, endpoints, scaling', 'Everything: drivers, frameworks, clusters']],
      ['You pay', ['Per user per month', 'Per token (or reserved throughput)', 'Per instance-hour', 'Per instance-hour']],
      ['Time to first result', ['Hours', 'Minutes', 'Days to weeks', 'Weeks']],
      ['Pick when', ['Internal productivity', 'Most product features', 'Custom models, ML teams', 'Frontier-scale training, custom platforms']]
    ]
  },
  examples: [
    ['A support chatbot that answers from your help center', ['bedrock', 'kb'], 'Bedrock for the model, Knowledge Bases to ground it in your articles.', 'Training your own model to "know" the help center is slow and goes stale.'],
    ['A fraud model trained on years of transactions', ['sagemaker'], 'Tabular ML (for example XGBoost) on your own data is SageMaker’s home turf.', 'LLMs are the wrong tool for scoring tabular data.'],
    ['5,000 employees want answers across SharePoint, Jira, and Slack', ['quick'], 'A ready-made assistant that respects document permissions.', 'Building the same on Bedrock takes weeks of connector and permission work.'],
    ['Serve a fine-tuned Llama with custom vLLM settings', ['sagemaker'], 'Bring your container and settings to a managed endpoint (or use Bedrock Custom Model Import if the architecture is supported).', 'Raw EC2 means owning autoscaling, health checks, and patching.'],
    ['A lab pretraining a 100-billion-parameter model', ['gpu', 'sagemaker'], 'Large clusters of P5/P6 or Trainium instances, with HyperPod replacing failed nodes automatically.', 'No managed API can pretrain a model for you.'],
    ['Extract fields from a million invoices a month', ['textract'], 'Per-page pricing and structured output with confidence scores.', 'Sending every page to an LLM costs more and can misread numbers.']
  ],
  quiz: [
    ['A startup wants a "summarize this document" button by Friday.', ['Train a model on EC2 GPUs', 'Amazon Bedrock', 'SageMaker HyperPod', 'Amazon Rekognition'], 1, 'Bedrock is an API call to a ready model; there is nothing to train or host.'],
    ['Predict customer churn from a table of usage data.', ['Bedrock with Claude', 'SageMaker AI', 'Amazon Polly', 'Amazon Quick'], 1, 'Tabular classification is classic ML: train and host it on SageMaker AI.'],
    ['HR wants employees to ask questions over internal wikis, with permissions respected, without engineering work.', ['Amazon Quick', 'EC2 GPU instances', 'Kinesis', 'Bedrock fine-tuning'], 0, 'A finished assistant with connectors and permissions built in.'],
    ['Turn 2 million scanned forms into structured fields as cheaply as possible.', ['Textract', 'A frontier LLM on every page', 'Transcribe', 'Comprehend'], 0, 'Textract is purpose-built OCR for forms, priced per page.']
  ],
  map: {
    title: 'One product, four levels of AI ownership',
    subtitle: 'Buy (Quick) · call an API (Bedrock) · host your own model (SageMaker AI) · train on raw accelerators · specialist AI services',
    layers: ['Client', 'Gateway', 'Compute', 'AI', 'Data'],
    nodes: [
      ['user', 'users', 'Customers', 'Client', 'Use the product’s AI features.'],
      ['staff', 'users', 'Employees', 'Client', 'Ask questions about company policies and data.'],
      ['apigw', 'apigateway', 'App API', 'Gateway', 'The front door for product features.'],
      ['app', 'lambda', 'App backend', 'Compute', 'Decides which AI service each request needs.'],
      ['gpu', 'gpu', 'Trn2 / P5 cluster', 'Compute', 'The ML team trains its own model on raw accelerators (or through SageMaker HyperPod).'],
      ['br', 'bedrock', 'Claude / Nova (tokens)', 'AI', 'Chat and summarization through an API, paid per token. No infrastructure.'],
      ['sm', 'sagemaker', 'Fraud model endpoint', 'AI', 'A custom model trained on your transactions, hosted on an endpoint you control.'],
      ['tx', 'textract', 'Read invoices', 'AI', 'Purpose-built OCR for forms and invoices: cheaper and more consistent than an LLM for this job.'],
      ['quick', 'quick', 'Employee assistant', 'AI', 'A finished assistant over company documents and apps, with permissions respected.'],
      ['docs', 's3', 'Data + model artifacts', 'Data', 'Training data, invoices, and trained models.'],
      ['apps', 'saas', 'SharePoint, Jira…', 'Data', 'Company apps the assistant connects to.', 'Company apps']
    ],
    edges: [
      ['user', 'apigw', 'request', 'sync', 'A product feature is used.'],
      ['apigw', 'app', 'invoke', 'sync', 'Routes to the backend.'],
      ['app', 'br', 'Converse API', 'sync', 'Prompt in, tokens out.'],
      ['br', 'app', 'tokens', 'sync', 'Streamed tokens, shown as they arrive.'],
      ['app', 'sm', 'score', 'sync', 'InvokeEndpoint scores a payment in milliseconds.'],
      ['app', 'tx', 'extract', 'sync', 'AnalyzeExpense returns structured fields from a PDF.'],
      ['tx', 'docs', 'read PDF', 'sync', 'From S3.'],
      ['apigw', 'user', 'response', 'sync', 'Back to the customer.'],
      ['staff', 'quick', 'ask in chat', 'sync', '"What is our parental leave policy?"'],
      ['quick', 'apps', 'connectors', 'sync', 'Connectors respect permissions: only documents this person may see.'],
      ['quick', 'staff', 'answer + sources', 'sync', 'With citations.'],
      ['gpu', 'docs', 'save model', 'sync', 'Training writes checkpoints and the final model to S3.'],
      ['docs', 'sm', 'deploy', 'async', 'The trained model artifact is loaded onto the endpoint.']
    ],
    flow: [
      ['Customer chats with the AI', 'Bedrock: an API call, billed per token.', 'user>apigw, apigw>app, app>br, br>app, apigw>user', 'read'],
      ['Score a payment for fraud', 'SageMaker AI: your own model on your own endpoint.', 'user>apigw, apigw>app, app>sm, apigw>user', 'read'],
      ['Process an invoice', 'A purpose-built AI service beats an LLM on cost and consistency.', 'app>tx, tx>docs', 'write'],
      ['Employee asks about a policy', 'Amazon Quick: buy, do not build.', 'staff>quick, quick>apps, quick>staff', 'read'],
      ['Train and deploy a custom model', 'Raw accelerators for training; the artifact is deployed to SageMaker AI.', 'gpu>docs, docs>sm', 'background']
    ],
    why: [
      'Each AI need sits at the highest level of the ladder that does the job: less to build, run, and pay for.',
      'Bedrock handles open-ended language tasks; specialist services handle narrow perception tasks better and cheaper.',
      'Custom models are reserved for what only your data can teach (fraud on your transactions).',
      'Employees get a bought assistant instead of an internal side project.'
    ],
    tradeoffs: [
      'Buying (Quick) is fastest but least flexible; building on Bedrock gives control at the cost of engineering time.',
      'Hosting your own model means paying for endpoints even when idle, and owning model quality.',
      'Per-token pricing is great at low volume; at very high steady volume, provisioned throughput or self-hosting can be cheaper.'
    ],
    sources: [['AWS decision guide: choosing a generative AI service', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/genai-guide.html'],
      ['Amazon Q Business availability change (now Amazon Quick)', 'https://docs.aws.amazon.com/amazonq/latest/qbusiness-ug/qbusiness-availability-change.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-rag', group: 'genai', title: 'RAG chatbot: Knowledge Bases + vector stores',
  question: 'How do I make an LLM answer from my own documents?',
  summary: 'RAG (retrieval-augmented generation) means: before asking the model, search your documents for the few passages that answer the question, paste them into the prompt, and tell the model to answer only from them, with citations. On AWS, Bedrock Knowledge Bases does the chunking, embedding, indexing, and retrieval; you choose the vector store and the model, and add Guardrails before real users see it.',
  services: ['kb', 'bedrock', 'opensearch', 's3vectors', 'aurora', 'guardrails', 'lambda', 'apigateway', 'cognito', 'dynamodb'],
  decide: [
    ['Most production chatbots: fast, managed, hybrid keyword + vector search', ['opensearch'], 'OpenSearch Serverless is the Knowledge Bases default. Note its minimum monthly cost.'],
    ['Your data already lives in Postgres and you want SQL filters (tenant, date)', ['aurora'], 'pgvector keeps the vectors next to the rows.'],
    ['Huge collections or low query rates, where cost matters most', ['s3vectors'], 'Up to ~90% cheaper; queries take ~100 ms warm and under a second cold.'],
    ['Answers must be safe and grounded in the sources', ['guardrails'], 'PII redaction, denied topics, and contextual grounding checks.'],
    ['Employees need a ready-made assistant, not a custom bot', ['quick'], 'Amazon Quick. (Amazon Kendra and Q Business are closed to new customers.)'],
    ['The knowledge changes often', ['kb'], 'Use RAG and re-sync. Fine-tune only to change style or behaviour.']
  ],
  compare: {
    title: 'Which vector store?',
    cols: ['opensearch', 'aurora', 's3vectors'],
    rows: [
      ['Query latency', ['Tens of ms', 'Tens of ms', '~100 ms warm, under 1 s cold']],
      ['Cost shape', ['Minimum compute (OCUs) even when idle', 'Part of a database you may already run', 'Pay per GB, write, and query; no minimum']],
      ['Search type', ['Vector + keyword (hybrid)', 'Vector + full SQL filters', 'Vector + metadata filters']],
      ['Scale', ['Billions, with enough compute', 'Millions comfortably', 'Up to 2 billion vectors per index']],
      ['Pick when', ['Production chat, high traffic', 'Postgres shops, multi-tenant filters', 'Big archives, low or bursty traffic']]
    ]
  },
  examples: [
    ['An HR policy bot over 2,000 PDFs', ['kb', 'opensearch', 'bedrock'], 'Knowledge Bases on an S3 bucket, OpenSearch Serverless for the index, and Claude for answers with citations.', 'Fine-tuning would bake in today’s policies and go stale.'],
    ['A SaaS app on Aurora wants "chat with your workspace", filtered by tenant', ['aurora', 'kb'], 'pgvector in the same database, with tenant_id in the SQL filter.', 'A separate vector store must be kept in sync and secured per tenant.'],
    ['100 million product reviews searchable by meaning, queried a few times a minute', ['s3vectors'], 'Storage-priced vectors, and the latency is fine for this traffic.', 'An always-on vector cluster would mostly sit idle.'],
    ['A customer bot must never reveal personal data or invent policy', ['guardrails'], 'PII redaction plus contextual grounding checks on every answer.', 'Prompt instructions alone are not a reliable safety control.'],
    ['The same long system prompt is sent with every request', ['bedrock'], 'Prompt caching cuts the cost and latency of the repeated prefix.', 'Paying full price for the same tokens on every call.']
  ],
  quiz: [
    ['Your docs change daily. How do you keep the bot current?', ['Fine-tune the model every night', 'RAG with a scheduled Knowledge Base sync', 'Raise the temperature', 'Use a bigger model'], 1, 'RAG reads the latest documents at question time; re-syncing updates the index.'],
    ['What does the embeddings model do in RAG?', ['Writes the final answer', 'Turns text into vectors so similar meanings can be found', 'Encrypts documents', 'Stores chat history'], 1, 'Vectors let the index find passages close in meaning to the question.'],
    ['Answers sometimes include facts that are not in the sources.', ['A Guardrails contextual grounding check', 'More NAT gateways', 'A bigger Lambda', 'CloudFront caching'], 0, 'The grounding check flags answers that the retrieved passages do not support.'],
    ['A low-traffic internal bot over 50 million chunks; cost matters more than 100 ms.', ['OpenSearch Serverless', 'S3 Vectors', 'ElastiCache', 'Redshift'], 1, 'S3 Vectors has no idle minimum and is priced like storage.']
  ],
  map: {
    title: 'RAG chatbot on Bedrock',
    subtitle: 'Ingest: S3 → Knowledge Bases → embeddings → vector index · Ask: retrieve passages → guardrails → Claude → answer with citations',
    layers: ['Client', 'Edge', 'Gateway', 'Compute', 'AI', 'Data'],
    nodes: [
      ['user', 'users', 'Employee in chat UI', 'Client', 'Asks questions about company policies.'],
      ['admin', 'users', 'Docs team', 'Client', 'Keeps the source documents up to date.'],
      ['cdn', 'cloudfront', 'Chat web app', 'Edge', 'Serves the chat UI.'],
      ['cog', 'cognito', 'Sign-in (JWT)', 'Gateway', 'Only employees can use the bot.'],
      ['apigw', 'apigateway', 'Chat API (WebSocket)', 'Gateway', 'Streams tokens back to the browser as they are generated.'],
      ['fn', 'lambda', 'Chat orchestrator', 'Compute', 'About 50 lines: load history, retrieve, check, generate, save. Knowledge Bases does the heavy lifting.'],
      ['kb', 'kb', 'Retrieve + cite', 'AI', 'Handles parsing, chunking, embedding, indexing, and retrieval with citations.'],
      ['embed', 'bedrock', 'Titan Text Embeddings', 'AI', 'Turns each chunk, and each question, into a vector of numbers that captures its meaning.', 'Embeddings model'],
      ['guard', 'guardrails', 'PII + grounding checks', 'AI', 'Screens the question and the answer: blocks prompt attacks, redacts PII, and flags answers the sources do not support.'],
      ['llm', 'bedrock', 'Claude (generate)', 'AI', 'Writes the answer using only the retrieved passages, with citations.'],
      ['docs', 's3', 'Policies (PDF, HTML)', 'Data', 'The source of truth for the bot’s knowledge.'],
      ['vec', 'opensearch', 'Vector index', 'Data', 'OpenSearch Serverless: vector plus keyword (hybrid) search over the chunks. S3 Vectors or Aurora pgvector are alternatives.'],
      ['hist', 'dynamodb', 'Chat history', 'Data', 'The last turns of each conversation, keyed by conversation id.']
    ],
    edges: [
      ['admin', 'docs', 'upload / update docs', 'sync', 'New and changed files.'],
      ['docs', 'kb', 'ingest', 'async', 'An ingestion job runs on a schedule or after uploads: parse and chunk.'],
      ['kb', 'embed', 'embed text', 'sync', 'Chunks at ingestion time; the question at query time.'],
      ['kb', 'vec', 'store / search vectors', 'sync', 'Writes chunks at ingestion; nearest-neighbor search at query time.'],
      ['user', 'cdn', 'open chat', 'sync', 'The static app, from the edge.'],
      ['user', 'cog', 'sign in', 'sync', 'Corporate sign-in through Cognito.'],
      ['cog', 'user', 'JWT', 'sync', 'Sent with every message.'],
      ['user', 'apigw', 'question + JWT', 'sync', 'Over a WebSocket.'],
      ['apigw', 'fn', 'invoke', 'sync', 'One invocation per message.'],
      ['fn', 'hist', 'history', 'sync', 'Loads and saves recent turns: context for follow-up questions.'],
      ['fn', 'kb', 'Retrieve(question)', 'sync', 'The top passages, with source links.'],
      ['fn', 'guard', 'check in + out', 'sync', 'ApplyGuardrail on the question and on the answer.'],
      ['fn', 'llm', 'prompt + sources', 'sync', 'The question plus retrieved passages: "Answer only from these sources."'],
      ['llm', 'fn', 'streamed answer', 'sync', 'Tokens as they are generated.'],
      ['apigw', 'user', 'answer + citations', 'sync', 'Streamed to the browser.']
    ],
    flow: [
      ['Ingest documents', 'Knowledge Bases parses and chunks each file, embeds the chunks, and stores them in the vector index.', 'admin>docs, docs>kb, kb>embed, kb>vec', 'background'],
      ['Sign in', 'Only employees get a token.', 'user>cdn, user>cog, cog>user', 'write'],
      ['Ask: retrieve', 'The question is embedded and matched against the index; the best passages come back with their sources.', 'user>apigw, apigw>fn, fn>hist, fn>kb, kb>embed, kb>vec', 'read'],
      ['Ask: generate', 'Guardrails screen the text, Claude answers from the passages, and the answer streams back with citations.', 'fn>guard, fn>llm, llm>fn, apigw>user', 'read']
    ],
    why: [
      'Retrieval keeps answers current: update the docs, re-sync, done. No retraining.',
      'Citations let users check answers, which builds trust and exposes bad retrieval.',
      'Guardrails run on both the question and the answer, so PII and off-topic requests are caught.',
      'Knowledge Bases does parsing, chunking, embedding, and indexing, so the application code stays small.'
    ],
    tradeoffs: [
      'Chunk size: small chunks retrieve precisely but lose context; large chunks keep context but dilute relevance.',
      'OpenSearch Serverless is fast but has a minimum monthly cost; S3 Vectors is far cheaper but slower.',
      'More retrieved passages improve recall but cost more tokens and latency.',
      'Managed Knowledge Bases is quick to build; a custom pipeline (LangChain, LlamaIndex) gives more control over parsing and reranking.'
    ],
    sources: [['Bedrock Knowledge Bases: how data becomes a knowledge base', 'https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-data.html'],
      ['S3 Vectors is generally available', 'https://aws.amazon.com/blogs/aws/amazon-s3-vectors-now-generally-available-with-increased-scale-and-performance/']]
  }
});

AWS_LESSONS.push({
  id: 'aws-agents', group: 'genai', title: 'AI agents: AgentCore harness vs Runtime vs workflows',
  question: 'How do I build an AI that takes actions, not just answers?',
  summary: 'An agent is an LLM in a loop: it reads the goal, decides which tool to call (look up an order, start a refund), reads the result, and repeats until done. On AWS, AgentCore runs agents in production. The managed harness lets you declare the model, tools, and instructions; Runtime hosts your own agent code. Memory, Gateway (tools), Identity (OAuth), and Observability plug into either. When the steps are fixed, a Step Functions workflow is simpler and safer than an agent.',
  services: ['agentcore', 'bedrock', 'guardrails', 'stepfunctions', 'lambda', 'kb', 'dynamodb'],
  decide: [
    ['Get a production agent running fast by declaring the model, tools, and instructions', ['agentcore'], 'The AgentCore harness runs the loop for you. It replaced Bedrock Agents Classic.'],
    ['You already have agent code (Strands, LangGraph, CrewAI) or need custom orchestration or several agents', ['agentcore'], 'Deploy your code on AgentCore Runtime and add Memory, Gateway, and Identity as needed.'],
    ['The steps are known and must be auditable; the AI is one step', ['stepfunctions'], 'A workflow calls Bedrock as a step. Predictable beats clever.'],
    ['Expose existing APIs and Lambda functions as tools', ['agentcore'], 'AgentCore Gateway turns them into MCP tools, with policies on what the agent may call.'],
    ['Keep the agent safe', ['guardrails', 'iam'], 'Guardrails on content, least-privilege IAM and Gateway policies on actions, and a human approval step for money.']
  ],
  compare: {
    title: 'Three ways to run an agent',
    cols: ['AgentCore harness', 'AgentCore Runtime', 'stepfunctions'],
    rows: [
      ['Who writes the loop', ['AWS (you write config)', 'You (any framework)', 'You (every step defined)']],
      ['Models', ['Bedrock, OpenAI, Gemini, others', 'Any model', 'Any (Bedrock as a step)']],
      ['Best for', ['Most new agents, fast', 'Existing code, custom or multi-agent logic', 'Predictable, auditable processes']],
      ['Run length', ['Session-based (microVM sessions up to 8 h)', 'Up to 8 h on microVMs, 14 days on Instances', 'Up to 1 year (Standard)']],
      ['Main risk', ['Less control over the loop', 'More code to own', 'Cannot adapt to surprises']]
    ]
  },
  examples: [
    ['A support agent that checks order status and starts returns', ['agentcore', 'lambda', 'guardrails'], 'A harness config with two Gateway tools (Lambda functions) and a guardrail.', 'A plain chatbot cannot look anything up or act.'],
    ['A LangGraph research agent needs per-user sessions and memory in production', ['agentcore'], 'Deploy the existing code on Runtime and add Memory.', 'Rewriting it as a harness config loses the custom graph logic.'],
    ['Refunds over $100 need a human', ['stepfunctions'], 'The agent starts a workflow that waits for approval.', 'Letting the model decide alone on money is a risk.'],
    ['The agent must use 30 internal REST APIs', ['agentcore'], 'Gateway turns them into MCP tools from their OpenAPI specs.', 'Hand-writing 30 tool wrappers inside the agent.'],
    ['Every night: extract, classify, and summarize 10,000 documents', ['stepfunctions', 'bedrock'], 'A fixed workflow with Bedrock steps and batch inference.', 'An agent adds cost and unpredictability where the steps never change.']
  ],
  quiz: [
    ['What is the AWS-recommended way to start a new managed agent in 2026?', ['Bedrock Agents Classic', 'The AgentCore harness', 'Amazon Kendra', 'App Runner'], 1, 'Bedrock Agents Classic closed to new customers in July 2026; the AgentCore harness replaces it.'],
    ['Your agent must act in GitHub on behalf of the signed-in user.', ['Hard-code a GitHub token', 'AgentCore Identity (OAuth)', 'IAM user keys', 'CloudFront signed URLs'], 1, 'Identity manages OAuth tokens per user, so the agent never holds secrets.'],
    ['The steps are always extract → validate → store. Agent or workflow?', ['Agent', 'Step Functions workflow', 'Either is equally good', 'Neither'], 1, 'Known steps belong in a workflow: cheaper, predictable, auditable.'],
    ['Which part decides which tool to call next?', ['The foundation model', 'CloudWatch', 'The vector store', 'API Gateway'], 0, 'The model reasons about the goal and picks the next tool; the runtime executes it.']
  ],
  map: {
    title: 'Customer-service agent on AgentCore',
    subtitle: 'Runtime runs the loop · Claude picks tools · Gateway exposes tools · Memory remembers · Identity holds OAuth · humans approve refunds',
    layers: ['Client', 'Gateway', 'AI', 'Tools', 'Data'],
    nodes: [
      ['user', 'users', 'Customer chat', 'Client', '"Where is my order? Can I return it?"'],
      ['lead', 'users', 'Support lead', 'Client', 'Approves refunds over $100.'],
      ['apigw', 'apigateway', 'Chat API', 'Gateway', 'The authenticated entry point.'],
      ['rt', 'agentcore', 'Runtime (agent loop)', 'AI', 'Runs the agent, from harness config or your own Strands or LangGraph code, in one isolated microVM per session.'],
      ['llm', 'bedrock', 'Claude (reasoning)', 'AI', 'Decides the next step: answer, or call which tool with which arguments.'],
      ['guard', 'guardrails', 'Safety filters', 'AI', 'Screens what goes in and what comes out.'],
      ['mem', 'agentcore', 'Memory (per customer)', 'AI', 'Short-term conversation plus long-term facts ("prefers email").'],
      ['gw', 'agentcore', 'Gateway (MCP tools)', 'Tools', 'Exposes your APIs and Lambda functions as MCP tools, with policies on what the agent may call.'],
      ['ident', 'agentcore', 'Identity (OAuth)', 'Tools', 'Holds OAuth tokens so the agent can act in Zendesk on the customer’s behalf.'],
      ['orders', 'lambda', 'get_order tool', 'Tools', 'Looks up order status.'],
      ['refund', 'stepfunctions', 'Refund + approval', 'Tools', 'Issues refunds and pauses for a human when the amount is over $100.'],
      ['kb', 'kb', 'Return policy docs', 'Tools', 'RAG over the return policy.'],
      ['db', 'dynamodb', 'Orders', 'Data', 'Order records.'],
      ['zd', 'saas', 'Zendesk', 'Data', 'A third-party ticketing system.', 'Zendesk']
    ],
    edges: [
      ['user', 'apigw', 'message', 'sync', 'Each chat turn.'],
      ['apigw', 'rt', 'invoke session', 'sync', 'The same session id for the whole conversation.'],
      ['rt', 'mem', 'recall / save', 'sync', 'Context from earlier turns and past visits.'],
      ['rt', 'llm', 'next step?', 'sync', 'Sends the goal, the history, and the list of tools.'],
      ['llm', 'rt', 'use get_order', 'sync', 'The model asks for get_order(1234), or gives a final answer.'],
      ['rt', 'guard', 'check', 'sync', 'Checks the reply before anything reaches the customer.'],
      ['rt', 'gw', 'call tool (MCP)', 'sync', 'One entry point for every tool.'],
      ['gw', 'orders', 'invoke', 'sync', 'A Lambda function.'],
      ['orders', 'db', 'read order', 'sync', 'By order id.'],
      ['gw', 'refund', 'start refund', 'async', 'Starts a workflow run.'],
      ['refund', 'lead', 'approve? (> $100)', 'async', 'Waits for a human callback.'],
      ['rt', 'kb', 'search policy', 'sync', 'Searches the return policy for grounded answers about the rules.'],
      ['gw', 'ident', 'OAuth token', 'sync', 'Gets the user’s OAuth token, so there are no secrets in the agent code.'],
      ['gw', 'zd', 'create ticket', 'sync', 'Opens the customer’s support case.'],
      ['apigw', 'user', 'reply', 'sync', 'Streamed to the chat.']
    ],
    flow: [
      ['"Where is my order?"', 'The model picks the get_order tool, the agent calls it through Gateway, and then answers.', 'user>apigw, apigw>rt, rt>mem, rt>llm, llm>rt, rt>gw, gw>orders, orders>db, apigw>user', 'read'],
      ['Answer from the policy', 'The agent searches the return policy, then a guardrail checks the reply.', 'rt>kb, rt>llm, rt>guard', 'read'],
      ['Refund with approval', 'Large refunds pause in Step Functions until the support lead approves.', 'rt>gw, gw>refund, refund>lead', 'write'],
      ['Open a Zendesk ticket', 'Identity supplies an OAuth token so the agent can act in a third-party app.', 'rt>gw, gw>ident, gw>zd', 'write']
    ],
    why: [
      'The model only decides; tools do the work, so every action is a normal, logged API call.',
      'Gateway is the single place to add tools and enforce what the agent may call.',
      'Money moves through a workflow with a human approval step, not on the model’s word alone.',
      'Each session runs isolated, with memory scoped to that customer.'
    ],
    tradeoffs: [
      'Agents are non-deterministic: the same question can take different paths, so evaluation and tracing are essential.',
      'Every loop iteration is another model call, which adds latency and token cost.',
      'More tools give more capability but more ways to go wrong; start with few, well-described tools.'
    ],
    sources: [['Amazon Bedrock AgentCore overview', 'https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html'],
      ['AgentCore harness vs Runtime', 'https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/harness-vs-runtime.html'],
      ['Bedrock Agents Classic maintenance mode', 'https://docs.aws.amazon.com/bedrock/latest/userguide/agents-classic-maintenance-mode.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-custom-models', group: 'genai', title: 'Custom models: train and deploy with SageMaker AI',
  question: 'When do I train my own model, and how do I serve it?',
  summary: 'Climb the customization ladder only as far as you need: better prompts first, then RAG for your facts, then fine-tuning for style or a narrow task, and full training only for what only your data can teach. SageMaker AI runs the training jobs and hosts the result; pick the inference option by traffic shape: real-time, serverless, asynchronous, or batch.',
  services: ['sagemaker', 'gpu', 'fsx', 's3', 'bedrock', 'cloudwatch'],
  decide: [
    ['The model is capable; it needs clearer instructions or examples', ['bedrock'], 'Prompt engineering. The cheapest and fastest step: try it first.'],
    ['It needs facts from your documents', ['kb'], 'RAG keeps answers current without retraining.'],
    ['It needs your tone, format, or a narrow task done reliably and cheaply', ['bedrock', 'sagemaker'], 'Fine-tuning: on Bedrock for supported models, or SageMaker AI (JumpStart) for open models.'],
    ['You need a predictive model on your own tabular data', ['sagemaker'], 'Classic ML: training jobs, endpoints, pipelines.'],
    ['Training at very large scale, where hardware will fail mid-run', ['sagemaker', 'gpu'], 'HyperPod clusters on P5/P6 or Trainium replace bad nodes and resume from checkpoints.']
  ],
  compare: {
    title: 'SageMaker AI inference options',
    cols: ['Real-time endpoint', 'Serverless inference', 'Asynchronous inference', 'Batch transform'],
    rows: [
      ['Latency', ['Milliseconds', 'Milliseconds, plus cold starts', 'Seconds to minutes (queued)', 'Minutes to hours (offline)']],
      ['Scales to zero', ['No', 'Yes', 'Yes', 'Runs only during the job']],
      ['GPUs', ['Yes', 'No (CPU only)', 'Yes', 'Yes']],
      ['Best for', ['Steady, interactive traffic', 'Spiky traffic, light models', 'Big payloads, long jobs (e.g. image generation)', 'Scoring a whole dataset nightly']]
    ]
  },
  examples: [
    ['Classify support tickets into 40 categories; 50,000 labeled examples', ['sagemaker', 'bedrock'], 'Fine-tune a small model: cheaper and faster per call than prompting a large one.', 'A big general model with long prompts costs more per ticket.'],
    ['Score 10 million customers for churn every night', ['sagemaker'], 'Batch transform reads from S3 and writes scores back; there is no endpoint to keep running.', 'A real-time endpoint would sit idle 23 hours a day.'],
    ['Image generation jobs that take two minutes each', ['sagemaker'], 'Asynchronous inference queues requests and scales to zero between bursts.', 'Real-time endpoints time out on long jobs and bill while idle.'],
    ['A recommendation model at 5,000 requests per second, 20 ms p99', ['sagemaker', 'gpu'], 'A real-time endpoint on GPU or Inferentia instances with autoscaling.', 'Serverless inference has cold starts and no GPUs.'],
    ['A training run on hundreds of GPUs for weeks', ['sagemaker', 'gpu', 'fsx'], 'HyperPod replaces failed nodes and resumes from the last checkpoint; FSx keeps the GPUs fed.', 'On a hand-built cluster, one bad GPU can stall the whole run.'],
    ['Try an open model this afternoon', ['bedrock', 'sagemaker'], 'Use it on Bedrock if it is hosted there; otherwise deploy it from JumpStart in a few clicks.', 'Building a serving stack from scratch just for a test.']
  ],
  quiz: [
    ['The bot answers in the wrong tone and format, but the facts are right.', ['RAG', 'Prompt engineering, then fine-tuning if needed', 'A bigger vector store', 'More GPUs'], 1, 'Tone and format are behaviour: fix them with prompts first, and fine-tune if prompts are not enough.'],
    ['Nightly scoring of an entire customer table.', ['Real-time endpoint', 'Batch transform', 'Serverless inference', 'API Gateway caching'], 1, 'Batch transform scores whole datasets offline and then shuts down.'],
    ['Requests carry 500 MB videos and take 10 minutes to process.', ['Serverless inference', 'Asynchronous inference', 'Lambda', 'CloudFront'], 1, 'Asynchronous inference handles large payloads and long processing, and scales to zero.'],
    ['Where do SageMaker training jobs write the trained model?', ['EBS', 'S3', 'DynamoDB', 'CloudTrail'], 1, 'Model artifacts (model.tar.gz) go to S3, where endpoints load them from.']
  ],
  map: {
    title: 'Train → register → deploy with SageMaker AI',
    subtitle: 'A pipeline trains on accelerators with fast storage, registers only good models, and deploys them to an endpoint the app calls',
    layers: ['Client', 'Gateway', 'Compute', 'AI', 'Data', 'Obs'],
    nodes: [
      ['ds', 'users', 'Data scientist', 'Client', 'Starts training runs and approves models.'],
      ['user', 'users', 'App users', 'Client', 'Get predictions inside the product.'],
      ['apigw', 'apigateway', 'Predict API', 'Gateway', 'The public entry point.'],
      ['fn', 'lambda', 'Prepare + call model', 'Compute', 'Builds the feature vector and calls the endpoint.'],
      ['gpu', 'gpu', 'ml.p5 / ml.trn2', 'Compute', 'The accelerated instances the training job runs on.'],
      ['pipe', 'sagemaker', 'Pipelines (MLOps)', 'AI', 'Process data → train → evaluate → register, defined as code.'],
      ['train', 'sagemaker', 'Training job', 'AI', 'Managed training: AWS starts the cluster, runs your script, saves the model, and shuts everything down.'],
      ['reg', 'sagemaker', 'Model Registry', 'AI', 'Versions every model with its metrics; only approved versions get deployed.'],
      ['ep', 'sagemaker', 'Real-time endpoint', 'AI', 'Autoscaling instances serving predictions in milliseconds.'],
      ['s3', 's3', 'Data + model.tar.gz', 'Data', 'Training data in, model artifacts out.'],
      ['fsx', 'fsx', 'Fast training input', 'Data', 'Linked to S3 so the GPUs read at full speed.'],
      ['cw', 'cloudwatch', 'Latency + errors', 'Obs', 'Endpoint metrics and alarms. Captured requests can be compared with the training data to spot drift.']
    ],
    edges: [
      ['ds', 'pipe', 'start pipeline', 'sync', 'Or on a schedule.'],
      ['pipe', 'train', 'run training step', 'sync', 'With hyperparameters.'],
      ['s3', 'fsx', 'link bucket', 'async', 'Lazy-loads the dataset.'],
      ['train', 'fsx', 'read batches', 'sync', 'High throughput.'],
      ['train', 'gpu', 'runs on', 'sync', 'Managed Spot training can cut cost by up to ~90%.'],
      ['train', 's3', 'checkpoints + model', 'sync', 'Resumable after interruptions.'],
      ['pipe', 'reg', 'register if metrics pass', 'sync', 'A quality gate.'],
      ['reg', 'ep', 'deploy approved version', 'async', 'Blue/green, with automatic rollback.'],
      ['user', 'apigw', 'POST /predict', 'sync', 'From the app.'],
      ['apigw', 'fn', 'invoke', 'sync', 'A Lambda function.'],
      ['fn', 'ep', 'InvokeEndpoint', 'sync', 'Milliseconds.'],
      ['ep', 'fn', 'prediction', 'sync', 'A score or a label.'],
      ['apigw', 'user', 'result', 'sync', 'Back to the app.'],
      ['ep', 's3', 'capture requests', 'async', 'Saved for drift analysis and retraining.'],
      ['ep', 'cw', 'latency, errors', 'obs', 'Alarms on p99 latency and 5xx errors.']
    ],
    flow: [
      ['Train a model', 'The pipeline runs a managed training job on accelerators, reading fast from FSx and saving to S3.', 'ds>pipe, pipe>train, s3>fsx, train>fsx, train>gpu, train>s3', 'background'],
      ['Register and deploy', 'Only models that pass evaluation are registered and rolled out.', 'pipe>reg, reg>ep', 'background'],
      ['Get a prediction', 'The app calls the endpoint through API Gateway and a Lambda function.', 'user>apigw, apigw>fn, fn>ep, ep>fn, apigw>user', 'read'],
      ['Watch the model in production', 'Requests are captured to S3 and metrics go to CloudWatch.', 'ep>s3, ep>cw', 'background']
    ],
    why: [
      'Training is a job, not a server: the cluster exists only while it trains.',
      'A registry and an evaluation gate mean a worse model never reaches production by accident.',
      'Fast storage keeps expensive accelerators busy instead of waiting on data.',
      'Captured requests let you detect drift and retrain on real traffic.'
    ],
    tradeoffs: [
      'Real-time endpoints bill every hour; use serverless, asynchronous, or batch when traffic allows.',
      'Fine-tuned models need retraining as base models and data change.',
      'Owning a model means owning its quality, bias checks, and monitoring.'
    ],
    sources: [['SageMaker AI: deploy models for inference', 'https://docs.aws.amazon.com/sagemaker/latest/dg/deploy-model.html'],
      ['AWS decision guide: choosing a generative AI service', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/genai-guide.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-ai-services', group: 'genai', title: 'Pre-trained AI: Textract, Transcribe, Rekognition vs an LLM',
  question: 'When is a purpose-built AI API better than an LLM?',
  summary: 'AWS has ready-made AI services for well-defined jobs: Textract reads documents, Transcribe turns speech into text, Rekognition analyzes images, Comprehend analyzes text, and Polly speaks. They are cheaper and more consistent than an LLM for those jobs. A good rule: specialists for perception (pixels and audio → text), an LLM on Bedrock for judgment (text → decisions).',
  services: ['textract', 'transcribe', 'rekognition', 'comprehend', 'polly', 'bedrock', 'stepfunctions'],
  decide: [
    ['Text, tables, and form fields from scanned documents', ['textract'], 'Per page, with confidence scores and positions.'],
    ['Speech to text: calls, meetings, voice notes', ['transcribe'], 'Speaker labels, custom vocabulary, PII redaction.'],
    ['Objects, faces, or unsafe content in images and video', ['rekognition'], 'Per image or per minute of video.'],
    ['Entities, sentiment, or PII in large volumes of text, cheaply', ['comprehend'], 'Per 100 characters.'],
    ['Text to natural speech', ['polly'], 'Neural and generative voices.'],
    ['Reasoning over the extracted text: summarize, decide, answer', ['bedrock'], 'Specialists handle perception; the LLM handles judgment. Bedrock Data Automation can also extract from mixed media in one API.']
  ],
  compare: {
    title: 'Specialist service vs LLM',
    cols: ['Purpose-built AI service', 'LLM on Bedrock'],
    rows: [
      ['Accuracy on its task', ['High and consistent', 'Good, but can make things up']],
      ['Output', ['Structured JSON with confidence scores', 'Free text (you ask for JSON)']],
      ['Cost', ['Per page, minute, or image; low', 'Per token; higher for long inputs']],
      ['Flexibility', ['Fixed tasks (some allow custom training)', 'Anything you can describe']],
      ['Use it for', ['Perception: pixels and audio → text', 'Judgment: text → decisions']]
    ]
  },
  examples: [
    ['Insurance claims: pull the policy number and amounts from scanned forms', ['textract', 'bedrock'], 'Textract extracts the fields; Bedrock summarizes the claim.', 'An LLM alone may misread digits in a blurry scan.'],
    ['Call center: transcribe and summarize every call', ['transcribe', 'bedrock'], 'Transcribe with speaker labels and PII redaction, then a Bedrock summary.', 'A text model cannot take raw audio, and a speech-to-speech model is overkill for summaries.'],
    ['Moderate user-uploaded photos', ['rekognition'], 'Moderation labels with confidence scores, per image.', 'An LLM call per image costs more and is slower.'],
    ['Redact PII across 10 million support tickets', ['comprehend'], 'Cheap per character at volume. Inside live chat apps, Guardrails does the same job.', 'An LLM pass over 10 million tickets is far more expensive.'],
    ['Understand a messy contract: "Can we terminate early?"', ['bedrock', 'textract'], 'Reasoning is the LLM’s job; run Textract first if the PDF is a scan.', 'Comprehend finds entities but cannot answer the question.']
  ],
  quiz: [
    ['Extract the total and vendor from 1 million receipts.', ['Textract AnalyzeExpense', 'Polly', 'A chatbot', 'CloudWatch'], 0, 'Purpose-built receipt extraction, priced per page.'],
    ['Turn call recordings into searchable text.', ['Rekognition', 'Transcribe', 'Textract', 'Polly'], 1, 'Transcribe is speech-to-text.'],
    ['Decide whether a customer email is a legal threat that needs escalation, and explain why.', ['Comprehend sentiment', 'An LLM on Bedrock', 'Rekognition', 'Textract'], 1, 'Nuanced judgment with an explanation is LLM work.'],
    ['Read the app’s daily briefing aloud to users.', ['Polly', 'Transcribe', 'Comprehend', 'Kinesis'], 0, 'Polly is text-to-speech.']
  ],
  map: {
    title: 'Insurance claims intake pipeline',
    subtitle: 'Specialist services extract (perception) · Comprehend masks PII · Bedrock summarizes (judgment) · Step Functions runs it all',
    layers: ['Client', 'Storage', 'Events', 'Compute', 'AI', 'Data'],
    nodes: [
      ['user', 'users', 'Customer (app)', 'Client', 'Submits a claim with a form, a voice note, and photos.'],
      ['adj', 'users', 'Claims adjuster', 'Client', 'Reviews the summary and decides.'],
      ['in', 's3', 'Claim uploads', 'Storage', 'The PDF form, the audio, and the photos.'],
      ['eb', 'eventbridge', 'Object created', 'Events', 'Starts the workflow when the files arrive.'],
      ['sfn', 'stepfunctions', 'Claim workflow', 'Compute', 'Runs each AI step with retries and records the result.'],
      ['tx', 'textract', 'Read claim form', 'AI', 'Policy number, dates, and amounts, with confidence scores.'],
      ['tr', 'transcribe', 'Voice note → text', 'AI', 'A transcript with PII redaction.'],
      ['rk', 'rekognition', 'Damage photo labels', 'AI', 'Labels such as "car", "dent", "broken glass".'],
      ['cp', 'comprehend', 'Find + redact PII', 'AI', 'Masks names and account numbers before the LLM sees the text.'],
      ['br', 'bedrock', 'Summarize + triage', 'AI', 'Reads everything extracted and writes a summary and a priority.'],
      ['pl', 'polly', 'Spoken status update', 'AI', 'Reads the status message aloud in the app.'],
      ['db', 'dynamodb', 'Claim record', 'Data', 'The extracted fields, the summary, and the priority.']
    ],
    edges: [
      ['user', 'in', 'upload files', 'sync', 'Through a pre-signed URL.'],
      ['in', 'eb', 'ObjectCreated', 'async', 'One event per upload.'],
      ['eb', 'sfn', 'start execution', 'async', 'One run per claim.'],
      ['sfn', 'tx', 'read form', 'sync', 'AnalyzeDocument (forms) reads the PDF from S3.'],
      ['sfn', 'tr', 'transcribe', 'async', 'StartTranscriptionJob, then wait for the job to finish.'],
      ['sfn', 'rk', 'label photos', 'sync', 'DetectLabels, one call per photo.'],
      ['sfn', 'cp', 'find PII', 'sync', 'DetectPiiEntities on all the extracted text.'],
      ['sfn', 'br', 'summarize', 'sync', 'Summarize and triage: text only, with PII already masked.'],
      ['sfn', 'db', 'save claim', 'sync', 'Fields, summary, and priority.'],
      ['sfn', 'pl', 'speak', 'sync', 'SynthesizeSpeech turns the status message into audio.'],
      ['pl', 'user', 'audio update', 'async', 'Played in the app.'],
      ['adj', 'db', 'review claim', 'sync', 'A dashboard reads the record.']
    ],
    flow: [
      ['Submit a claim', 'Files land in S3 and an event starts the workflow.', 'user>in, in>eb, eb>sfn', 'write'],
      ['Perception: extract', 'Specialist services turn pixels and audio into structured text.', 'sfn>tx, sfn>tr, sfn>rk', 'background'],
      ['Judgment: clean and summarize', 'PII is masked, then Bedrock writes the summary and the priority.', 'sfn>cp, sfn>br, sfn>db', 'background'],
      ['Notify and review', 'Polly speaks the status, and the adjuster reviews the record.', 'sfn>pl, pl>user, adj>db', 'read']
    ],
    why: [
      'Each AI step uses the cheapest tool that does it well: specialists for perception, an LLM only for judgment.',
      'PII is masked before the LLM ever sees the text.',
      'Step Functions makes every step retryable and leaves a record of what each service returned.'
    ],
    tradeoffs: [
      'More services means more integrations to maintain than a single "send everything to an LLM" call.',
      'Specialist services have fixed capabilities; unusual documents may still need an LLM fallback.',
      'Waiting on transcription jobs makes the whole claim take seconds to minutes, not milliseconds.'
    ],
    sources: [['Amazon Textract', 'https://aws.amazon.com/textract/'], ['Amazon Transcribe', 'https://aws.amazon.com/transcribe/']]
  }
});
