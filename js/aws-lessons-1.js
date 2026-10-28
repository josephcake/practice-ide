/* ============================================================
   AWS LESSONS, part 1: the big picture and the core services
   Each lesson pairs an architecture canvas with a decision guide.

   decide:   [when this is your situation, [service ids], why]
   compare:  { title, cols: [service id or plain label], rows: [[row label, [cell per col]]] }
   examples: [scenario, [service ids to use], why, why not the alternative]
   quiz:     [question, [options], index of the answer, explanation]
   map.nodes: [id, service id, role on this map, layer, detail, label?, badge?]
   map.edges: [from, to, label, sync | async | obs, detail]
   map.flow:  [title, detail, 'a>b, b>c', read | write | background]
   ============================================================ */

const AWS_LESSONS = [];

AWS_LESSONS.push({
  id: 'aws-overview', group: 'start', title: 'AWS in one picture',
  question: 'What are the main AWS building blocks, and how do they fit together?',
  summary: 'Almost every AWS app is the same seven layers: a way in (DNS, CDN, firewall), a front door (load balancer or API Gateway), compute (where code runs), messaging (queues and events), data (databases and storage), AI (models), and guard rails around everything (permissions, encryption, monitoring). Learn this one picture and every service has a place.',
  services: ['route53', 'cloudfront', 'elb', 'fargate', 'lambda', 'sqs', 'eventbridge', 's3', 'elasticache', 'aurora', 'dynamodb', 'bedrock', 'cloudwatch', 'iam'],
  decide: [
    ['A way in: names, caching, and filtering at the edge', ['route53', 'cloudfront', 'waf'], 'Every request passes through here first.'],
    ['A front door that spreads or checks traffic', ['elb', 'apigateway'], 'ALB for web apps on containers; API Gateway for serverless and partner APIs.'],
    ['Somewhere for code to run', ['lambda', 'fargate', 'ecs', 'eks', 'ec2'], 'From "just a function" to "a whole server you manage".'],
    ['A way to hand off slow work', ['sqs', 'sns', 'eventbridge', 'kinesis', 'stepfunctions'], 'So users never wait for it.'],
    ['Places to keep data', ['s3', 'aurora', 'rds', 'dynamodb', 'elasticache', 'opensearch'], 'Pick by the shape of the data and how you read it.'],
    ['AI', ['bedrock', 'kb', 'agentcore', 'sagemaker'], 'Call models, ground them in your data, let them take actions, or train your own.'],
    ['Guard rails around everything', ['iam', 'kms', 'cloudwatch', 'cloudtrail', 'cloudformation'], 'Permissions, encryption, monitoring, audit, and infrastructure defined in code.']
  ],
  examples: [
    ['A weekend MVP with unpredictable traffic', ['s3', 'cloudfront', 'apigateway', 'lambda', 'dynamodb'], 'Everything is serverless, so it costs close to nothing when nobody uses it and scales on launch day.', 'An EC2 server would bill around the clock and need patching.'],
    ['A steady B2B SaaS with complex reports', ['elb', 'fargate', 'aurora', 'elasticache'], 'Containers stay warm for steady traffic, and SQL handles joins and reports.', 'DynamoDB would make every new ad-hoc report painful.'],
    ['Adding an AI assistant to an existing app', ['bedrock', 'kb', 'guardrails'], 'Call Bedrock from your existing API. Add Knowledge Bases when it must answer from your documents, and Guardrails before it faces customers.', 'Self-hosting a model on GPUs is weeks of work and a large fixed bill.'],
    ['A data team wants to analyze a year of events', ['firehose', 's3', 'glue', 'athena'], 'Land events in S3, catalog them, and query with SQL, paying only per query.', 'Running analytics on the production database slows down customers.']
  ],
  quiz: [
    ['Where should a React app’s built files live so users worldwide load them fast?', ['On an EC2 web server', 'S3 behind CloudFront', 'In DynamoDB', 'On an EBS volume'], 1, 'S3 stores the files cheaply and CloudFront serves them from an edge near each user. There are no servers to run.'],
    ['Your API must send a welcome email after sign-up without making the user wait. What goes between the API and the email code?', ['A bigger EC2 instance', 'An SQS queue', 'Route 53', 'CloudFront'], 1, 'The API drops a message in SQS and returns at once; a worker sends the email when it can, with retries.'],
    ['Which service decides which AWS actions your Lambda function may perform?', ['Cognito', 'IAM', 'KMS', 'WAF'], 1, 'IAM roles and policies grant permissions to code and people inside AWS. Cognito is for your app’s customers.'],
    ['You want a chatbot powered by Claude without managing GPUs. Which service?', ['SageMaker AI', 'EC2 GPU instances', 'Amazon Bedrock', 'Amazon Rekognition'], 2, 'Bedrock gives API access to Claude and other models, billed per token.'],
    ['Who did what in your AWS account last Tuesday?', ['CloudWatch', 'CloudTrail', 'X-Ray', 'Route 53'], 1, 'CloudTrail records every API call. CloudWatch covers metrics and logs about how your app runs.']
  ],
  map: {
    title: 'A typical AWS web app with an AI feature',
    subtitle: 'Seven layers: edge, front door, compute, messaging, data, AI, monitoring',
    layers: ['Client', 'Edge', 'Compute', 'Async', 'Data', 'AI', 'Obs'],
    nodes: [
      ['user', 'users', 'Browser + phone app', 'Client', 'Your customers. Every request starts and ends here.'],
      ['dns', 'route53', 'example.com → edge', 'Edge', 'Turns your domain name into the address of the nearest CloudFront edge.'],
      ['cdn', 'cloudfront', 'CDN + WAF rules', 'Edge', 'Serves the website from an edge near the user and forwards /api calls to the load balancer. WAF rules attached here block bad traffic early.'],
      ['alb', 'elb', 'Routes /api/*', 'Edge', 'Spreads API calls across healthy containers in several Availability Zones.'],
      ['api', 'fargate', 'API containers (ECS)', 'Compute', 'The main backend: always-on containers that handle every API call. ECS keeps them running; Fargate means no servers to patch.'],
      ['worker', 'lambda', 'Thumbnails + jobs', 'Compute', 'Short functions that run only when there is work: a photo was uploaded, a job is waiting, an event fired.'],
      ['queue', 'sqs', 'Job queue', 'Async', 'Holds slow work (emails, exports) so the API can answer right away. Workers drain it at their own pace.'],
      ['bus', 'eventbridge', 'OrderPlaced events', 'Async', 'Routes business events to every team that cares, without the API knowing who they are.'],
      ['s3', 's3', 'Site files + uploads', 'Data', 'Stores the built website and every user photo, cheaply and durably.'],
      ['cache', 'elasticache', 'Hot reads (Valkey)', 'Data', 'Keeps popular data in memory so most reads skip the database.'],
      ['db', 'aurora', 'Users, orders (SQL)', 'Data', 'The source of truth for relational data that needs transactions.'],
      ['ddb', 'dynamodb', 'Sessions + carts', 'Data', 'Simple key lookups with huge, spiky traffic.'],
      ['llm', 'bedrock', 'Claude / Nova via API', 'AI', 'The AI assistant. The API sends a prompt and streams back the answer; there are no GPUs to run.'],
      ['cw', 'cloudwatch', 'Logs, metrics, alarms', 'Obs', 'Every service reports here, and alarms page someone when errors climb.']
    ],
    edges: [
      ['user', 'dns', 'look up example.com', 'sync', 'The browser asks DNS where the site lives.'],
      ['user', 'cdn', 'HTTPS', 'sync', 'Every page load and API call goes to the nearest CloudFront edge.'],
      ['user', 's3', 'pre-signed upload', 'sync', 'The API hands out a short-lived pre-signed URL so the large file goes straight to S3, never through your servers.'],
      ['cdn', 's3', 'cache miss: site files', 'sync', 'Only when the edge does not already have the file.'],
      ['cdn', 'alb', '/api/* requests', 'sync', 'Dynamic requests are forwarded to the load balancer.'],
      ['alb', 'api', 'forward', 'sync', 'To a healthy container, spread across several Availability Zones.'],
      ['api', 'cache', 'get product', 'sync', 'Memory first.'],
      ['api', 'db', 'read / write SQL', 'sync', 'Transactions for orders and accounts.'],
      ['api', 'ddb', 'session', 'sync', 'Get the session or cart: single-digit millisecond lookups by key.'],
      ['api', 'llm', 'prompt', 'sync', 'A Converse API call with the question and context.'],
      ['llm', 'api', 'streamed answer', 'sync', 'Tokens stream back as they are generated.'],
      ['api', 'queue', 'enqueue', 'async', 'Adds a job; the API does not wait for it.'],
      ['api', 'bus', 'OrderPlaced', 'async', 'Publish and forget; rules decide who receives it.'],
      ['queue', 'worker', 'poll a batch', 'async', 'Lambda polls the queue and processes messages in batches.'],
      ['bus', 'worker', 'rule match', 'async', 'A rule routes the event to the function.'],
      ['s3', 'worker', 'ObjectCreated', 'async', 'S3 emits an event when a photo lands.'],
      ['worker', 's3', 'thumbnail', 'sync', 'Writes the resized image back.'],
      ['cdn', 'user', 'page + API response', 'sync', 'Responses flow back through the edge.'],
      ['api', 'cw', 'logs + metrics', 'obs', 'Errors, latency, and custom metrics.'],
      ['worker', 'cw', 'logs + metrics', 'obs', 'Function duration, errors, throttles.']
    ],
    flow: [
      ['Open the website', 'DNS points to CloudFront, which serves the cached site from a nearby edge and goes to S3 only on a miss.', 'user>dns, user>cdn, cdn>s3, cdn>user', 'read'],
      ['Load my orders', 'The API checks the cache, then the database, and responds through the edge.', 'user>cdn, cdn>alb, alb>api, api>cache, api>db, cdn>user', 'read'],
      ['Place an order', 'A transaction in Aurora, then an event so other teams react on their own time.', 'user>cdn, cdn>alb, alb>api, api>db, api>bus, bus>worker, cdn>user', 'write'],
      ['Upload a photo', 'The file goes straight to S3; S3 triggers a Lambda function that makes the thumbnail.', 'user>s3, s3>worker, worker>s3', 'write'],
      ['Ask the AI assistant', 'The API calls Bedrock and streams the answer back. The model is just another API.', 'user>cdn, cdn>alb, alb>api, api>ddb, api>llm, llm>api, cdn>user', 'read'],
      ['Run a background job', 'Slow work waits in SQS until a function is free; everything reports to CloudWatch.', 'api>queue, queue>worker, worker>cw, api>cw', 'background']
    ],
    why: [
      'Each layer has one job, so you can swap a service without redesigning the rest (for example Fargate → Lambda).',
      'Static files never touch your servers: CloudFront and S3 serve them for pennies.',
      'Anything slow goes through SQS or EventBridge, so the user never waits for it.',
      'Bedrock is called like any other API, so the AI feature is one more box, not a new platform.'
    ],
    tradeoffs: [
      'Managed services cost more per unit than running your own on EC2, but save a lot of engineering time.',
      'Every extra service is one more thing to learn, secure, and monitor. Start with the fewest that fit.',
      'Lock-in: DynamoDB, EventBridge, and Bedrock APIs are AWS-specific; Postgres and containers move more easily.'
    ],
    sources: [['AWS decision guide: choosing a compute service', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html'],
      ['AWS decision guide: choosing a database', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/databases-on-aws-how-to-choose.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-compute', group: 'core', title: 'Compute: Lambda vs Fargate vs EKS vs EC2',
  question: 'Where should my code run?',
  summary: 'The four options trade control for convenience. Lambda runs a function per event and costs nothing when idle. Fargate runs containers without servers. EKS gives you Kubernetes. EC2 gives you the whole server, including GPUs. Most real systems use more than one: pick per workload, not per company.',
  services: ['lambda', 'fargate', 'ecs', 'eks', 'ec2', 'gpu'],
  decide: [
    ['Short tasks triggered by events, or traffic that is spiky or often zero', ['lambda'], 'You pay per millisecond and nothing when idle. Each synchronous call must finish within 15 minutes.'],
    ['A containerized service that runs all day, without servers to manage', ['fargate', 'ecs'], 'ECS keeps the containers running; Fargate means no hosts. ECS Express Mode puts a container on an HTTPS URL in one step.'],
    ['Your company already runs Kubernetes, or must run on several clouds', ['eks'], 'Keep your Helm charts, operators, and skills. Expect to own upgrades and add-ons.'],
    ['You need GPUs, a custom OS or agent, licensed software, or the lowest price for steady 24/7 load', ['ec2', 'gpu'], 'Savings Plans for steady load; Spot for work that can be retried.'],
    ['Long batch jobs that can be retried if interrupted', ['ec2'], 'Run them on Spot instances (through AWS Batch, ECS, or Karpenter) for up to 90% off.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['lambda', 'fargate', 'eks', 'ec2'],
    rows: [
      ['You manage', ['Just the code', 'A container image and its size', 'Kubernetes manifests, add-ons, upgrades', 'Everything: OS, patches, scaling']],
      ['Longest run', ['15 min per call (90 min async on Managed Instances)', 'No limit', 'No limit', 'No limit']],
      ['Scales', ['Per request, in seconds', 'Adds tasks in about a minute', 'Pods in seconds, nodes in minutes', 'Adds servers in minutes']],
      ['You pay for', ['Requests + ms of run time; $0 when idle', 'vCPU + memory per second while running', '$0.10/hr per cluster + the nodes', 'Server-seconds; up to 72% off (Savings Plans) or 90% (Spot)']],
      ['GPUs', ['No', 'No', 'Yes (EC2 nodes)', 'Yes']],
      ['Best for', ['Events, glue, spiky APIs', 'Steady web services and workers', 'Kubernetes shops, big platforms', 'Control, GPUs, cheapest steady load']]
    ]
  },
  examples: [
    ['Resize every photo uploaded to S3', ['lambda'], 'Event-driven, a few seconds of work, and no cost at 3 AM when nobody uploads.', 'An EC2 server would sit idle, and billed, most of the night.'],
    ['A Node.js REST API serving about 2,000 requests per second all day', ['fargate', 'ecs'], 'Steady traffic keeps containers busy, database connections are pooled, and the same image runs on your laptop.', 'Lambda costs more at constant high load and makes database connection pooling awkward.'],
    ['200 microservices already on Kubernetes move to AWS', ['eks'], 'Keep the Helm charts, operators, and the team’s Kubernetes skills.', 'Re-describing 200 services for ECS is wasted work.'],
    ['Fine-tune and host an open-source model on GPUs', ['gpu', 'sagemaker'], 'Only EC2 accelerated instances, used directly or through SageMaker AI, provide GPUs.', 'Lambda and Fargate have no GPUs.'],
    ['Nightly video encoding that can be retried', ['ec2'], 'EC2 Spot through AWS Batch or Karpenter is up to 90% cheaper, and an interruption just requeues the job.', 'On-Demand prices for the same work cost several times more.'],
    ['A Slack bot used 50 times a day', ['lambda', 'apigateway'], 'Costs cents per month and needs no maintenance.', 'Even the smallest always-on container bills every hour.']
  ],
  quiz: [
    ['A webhook receiver gets zero requests most hours, then 5,000 in one minute when a partner runs a batch.', ['EC2 with Auto Scaling', 'Lambda', 'EKS', 'One Fargate task'], 1, 'Lambda scales per request in seconds and costs nothing during the quiet hours.'],
    ['Each uploaded file takes about 40 minutes to process, and the caller waits for the result.', ['Lambda', 'A Fargate task (ECS)', 'API Gateway', 'CloudFront'], 1, 'Synchronous Lambda calls stop at 15 minutes. A container task on Fargate can run as long as it needs.'],
    ['A Spring Boot API with steady traffic; the team does not want to patch servers and has no Kubernetes experience.', ['ECS on Fargate', 'EKS on EC2', 'EC2 with a hand-built image', 'Lambda'], 0, 'Containers fit steady traffic, Fargate removes servers, and ECS is simpler than Kubernetes.'],
    ['Train a 7-billion-parameter model for three days on 8 GPUs.', ['Lambda', 'Fargate', 'EC2 GPU instances (or SageMaker AI training)', 'Step Functions'], 2, 'Only accelerated EC2 instances provide GPUs; SageMaker AI can manage the training job on them for you.'],
    ['The company runs Helm charts and Argo CD across AWS and its own data centers.', ['ECS', 'EKS', 'Lambda', 'Fargate alone'], 1, 'EKS is standard Kubernetes, so the same tooling works everywhere.']
  ],
  map: {
    title: 'Video-sharing app: each workload on the compute that fits',
    subtitle: 'Always-on API on Fargate · event work on Lambda · GPU batch on EC2 Spot · Kubernetes where the team needs it',
    layers: ['Client', 'Gateway', 'Compute', 'Async', 'Data'],
    nodes: [
      ['user', 'users', 'Viewers + uploaders', 'Client', 'People watching and uploading videos.'],
      ['slack', 'saas', 'Slack workspace', 'Client', 'A team uses a slash command to look up a video.', 'Slack'],
      ['alb', 'elb', 'Main web API', 'Gateway', 'Steady, all-day traffic to the containers.'],
      ['apigw', 'apigateway', 'Bot webhook', 'Gateway', 'Receives Slack slash commands a few dozen times a day.'],
      ['web', 'fargate', 'Web API (ECS tasks)', 'Compute', 'Always-on containers serving browse and search all day. Steady traffic suits containers: always warm, no servers to patch.'],
      ['k8s', 'eks', 'Recommendations (K8s)', 'Compute', 'The ML platform team already runs its recommendation services on Kubernetes with Helm and operators, so they stay on EKS.'],
      ['thumb', 'lambda', 'Make thumbnails', 'Compute', 'Runs only when a video lands in S3. Seconds of work, and zero cost when nobody uploads.'],
      ['bot', 'lambda', 'Slack bot handler', 'Compute', 'Runs a few dozen times a day and costs cents a month.'],
      ['encode', 'ec2', 'GPU encoders (Spot)', 'Compute', 'Hour-long encoding jobs on GPU instances. Spot is up to 90% cheaper, and an interrupted job simply goes back on the queue.'],
      ['jobs', 'sqs', 'Encode jobs', 'Async', 'Holds encoding work until a Spot instance is free; failed or interrupted jobs reappear.'],
      ['s3', 's3', 'Raw + encoded video', 'Data', 'Uploads go straight here, and encoded versions are written back.'],
      ['meta', 'dynamodb', 'Video metadata', 'Data', 'Titles, owners, and view counts by video id.']
    ],
    edges: [
      ['user', 'alb', 'HTTPS', 'sync', 'Browse and search.'],
      ['alb', 'web', 'forward', 'sync', 'Spread across tasks in several Availability Zones.'],
      ['web', 'meta', 'read videos', 'sync', 'Lookups by video id.'],
      ['web', 'k8s', 'recommend', 'sync', 'An internal call to the Kubernetes recommendation service.'],
      ['k8s', 'meta', 'read watch history', 'sync', 'Inputs for the recommendation model.'],
      ['alb', 'user', 'JSON', 'sync', 'The response goes back to the browser.'],
      ['user', 's3', 'pre-signed upload', 'sync', 'Large files skip your servers.'],
      ['s3', 'thumb', 'ObjectCreated', 'async', 'S3 invokes the function for each new upload.'],
      ['thumb', 's3', 'write thumbnail', 'sync', 'A JPEG next to the video.'],
      ['s3', 'jobs', 'new video → job', 'async', 'S3 event notifications can send straight to SQS.'],
      ['jobs', 'encode', 'pull job', 'async', 'Workers on Spot instances pull jobs when free.'],
      ['encode', 's3', 'write renditions', 'sync', '1080p, 720p, and 480p versions.'],
      ['slack', 'apigw', 'slash command', 'sync', 'An HTTPS webhook from Slack.'],
      ['apigw', 'bot', 'invoke', 'sync', 'One Lambda invocation per command.'],
      ['bot', 'meta', 'look up video', 'sync', 'A key lookup.'],
      ['bot', 'slack', 'reply', 'sync', 'Posts the answer back.']
    ],
    flow: [
      ['Browse videos', 'Steady traffic hits always-warm containers on Fargate; recommendations come from the Kubernetes team’s service.', 'user>alb, alb>web, web>meta, web>k8s, k8s>meta, alb>user', 'read'],
      ['Upload a video', 'The file lands in S3, a Lambda function makes the thumbnail, and an encoding job is queued for GPU workers.', 'user>s3, s3>thumb, thumb>s3, s3>jobs', 'write'],
      ['Encode on Spot GPUs', 'Workers on EC2 Spot pull jobs, encode, and write the results. Interrupted jobs return to the queue.', 'jobs>encode, encode>s3', 'background'],
      ['Slack slash command', 'A rare, tiny request: API Gateway invokes a Lambda function that answers in milliseconds.', 'slack>apigw, apigw>bot, bot>meta, bot>slack', 'read']
    ],
    why: [
      'Steady traffic goes to containers on Fargate: cheaper and warmer than per-request functions at that volume.',
      'Bursty, event-driven work goes to Lambda: it costs nothing when idle and scales instantly.',
      'GPU and heavy batch work goes to EC2, on Spot, because jobs can be retried.',
      'Kubernetes (EKS) is used only where the team already depends on it; everything else stays simpler.'
    ],
    tradeoffs: [
      'Lambda: a 15-minute limit per synchronous call, cold starts, and per-request pricing that gets expensive at constant high load.',
      'Fargate: usually costs more per vCPU than a well-packed EC2 fleet and has no GPUs, in exchange for no servers.',
      'EKS: the most flexible, but you pay for the control plane and need Kubernetes skills.',
      'EC2: the cheapest at steady scale with Savings Plans, but you own patching, images, and scaling.'
    ],
    sources: [['AWS decision guide: choosing a compute service', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-compute-service.html'],
      ['AWS decision guide: choosing a container service', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/choosing-aws-container-service.html'],
      ['Lambda quotas', 'https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-storage', group: 'core', title: 'Storage: S3 vs EBS vs EFS vs FSx',
  question: 'Where do my files and disks live?',
  summary: 'S3 is a warehouse for files you fetch by name over HTTPS: the default for almost everything. EBS is a disk attached to one server. EFS is a shared folder many servers mount at once. FSx for Lustre is a very fast file system that feeds GPU clusters from S3.',
  services: ['s3', 'ebs', 'efs', 'fsx'],
  decide: [
    ['Files you store and fetch by name: photos, video, backups, logs, datasets, model weights', ['s3'], 'The cheapest per GB, effectively unlimited, and reachable from anywhere over HTTPS.'],
    ['A disk for one server: its operating system or a database you run yourself', ['ebs'], 'Block storage with sub-millisecond latency, attached to one instance in one zone.'],
    ['A folder many servers, containers, or functions use at the same time', ['efs'], 'Standard NFS, elastic, across zones. Costs roughly 10× S3 per GB.'],
    ['Feeding GPUs at hundreds of GB/s during training, or HPC', ['fsx'], 'A parallel file system linked to your S3 bucket.'],
    ['Data you must keep for years but rarely read', ['s3'], 'Lifecycle rules move it to Glacier storage classes automatically.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['s3', 'ebs', 'efs', 'fsx'],
    rows: [
      ['What it is', ['Object storage over HTTPS', 'A disk for one server', 'A shared NFS file system', 'A high-speed parallel file system']],
      ['Who can use it', ['Anyone with permission, from anywhere', 'One EC2 instance in one zone', 'Thousands of servers, containers, functions', 'A compute cluster (EC2, SageMaker, EKS)']],
      ['Latency', ['Tens of ms (single-digit with Express One Zone)', 'Sub-millisecond', 'Low milliseconds', 'Sub-millisecond']],
      ['Cost per GB-month', ['~$0.023 (Standard) down to ~$0.001 (Deep Archive)', '~$0.08 (gp3) for the size you allocate', '~$0.30 (Standard) for what you store', 'Provisioned capacity + throughput']],
      ['Best for', ['Uploads, media, backups, lakes, models', 'OS disks, self-run databases', 'Shared content, home folders', 'ML training, HPC']]
    ]
  },
  examples: [
    ['User profile photos and videos', ['s3', 'cloudfront'], 'Cheap, durable, and served fast worldwide through the CDN.', 'EBS ties files to one server; EFS costs about 10× more for files nobody mounts.'],
    ['Self-managed PostgreSQL on EC2', ['ebs'], 'A database needs a block device with fast random writes.', 'S3 is object storage; a database cannot keep its data files there.'],
    ['Ten WordPress containers sharing one uploads folder', ['efs'], 'One NFS file system mounted by every container.', 'An EBS volume normally attaches to a single instance.'],
    ['Train a model on 50 TB of images with 64 GPUs', ['fsx', 's3'], 'FSx for Lustre, linked to the S3 bucket, keeps every GPU busy.', 'Reading straight from S3 can leave expensive GPUs waiting on data.'],
    ['Keep seven years of audit logs for compliance', ['s3'], 'A lifecycle rule to Glacier Deep Archive costs about $1 per TB-month.', 'Keeping them in S3 Standard costs over 20× more.']
  ],
  quiz: [
    ['Where do you store model checkpoints that many jobs and endpoints read later?', ['EBS', 'S3', 'EFS', 'ElastiCache'], 1, 'S3 is the shared, durable home for artifacts; SageMaker and Bedrock read models from S3.'],
    ['Four EC2 instances must read and write the same directory of files at once.', ['EBS', 'EFS', 'S3 Glacier', 'Route 53'], 1, 'EFS is a shared file system that many instances mount at the same time.'],
    ['Your bill shows a 2 TB EBS volume that is only 5% full. Why are you paying for all 2 TB?', ['EBS charges per GB written', 'EBS charges for the size you provision, not what you use', 'Snapshots double the cost', 'Data transfer'], 1, 'EBS bills for allocated size. EFS and S3 bill for what you actually store.'],
    ['Compliance requires keeping raw logs for 7 years; they are almost never read.', ['S3 Standard', 'EBS snapshots', 'S3 Glacier Deep Archive via a lifecycle rule', 'EFS'], 2, 'Deep Archive is the cheapest storage on AWS, and a lifecycle rule moves objects there automatically.']
  ],
  map: {
    title: 'Photo app and ML team: where each byte lives',
    subtitle: 'Uploads in S3 · a database disk on EBS · a shared folder on EFS · a fast training layer on FSx',
    layers: ['Client', 'Edge', 'Compute', 'Data'],
    nodes: [
      ['user', 'users', 'Uploads + views', 'Client', 'People sharing photos.'],
      ['cdn', 'cloudfront', 'Serves images', 'Edge', 'Caches photos at the edge, so S3 is hit only on a miss.'],
      ['app', 'ec2', 'API + own Postgres', 'Compute', 'An EC2 server running the API and a self-managed Postgres database.'],
      ['cms', 'fargate', 'CMS containers (×10)', 'Compute', 'Ten copies of a CMS that all read and write the same uploads folder.'],
      ['train', 'sagemaker', 'GPU training job', 'Compute', 'The ML team trains an image model on a GPU cluster.'],
      ['ebs', 'ebs', 'Postgres data disk', 'Data', 'A gp3 volume attached to the EC2 server: sub-millisecond random I/O for the database.'],
      ['efs', 'efs', 'Shared /uploads folder', 'Data', 'Mounted by all ten CMS containers at once over NFS.'],
      ['s3', 's3', 'Photos, data, models', 'Data', 'Every photo, the training dataset, and model checkpoints.'],
      ['glacier', 's3', 'Originals after 1 year', 'Data', 'A lifecycle rule moves old originals to Glacier Deep Archive for about $1 per TB-month.', 'S3 Glacier'],
      ['fsx', 'fsx', 'Training scratch', 'Data', 'Linked to the S3 bucket; feeds the GPUs at very high throughput during training.']
    ],
    edges: [
      ['user', 'app', 'ask for upload URL', 'sync', 'The API signs a short-lived URL.'],
      ['app', 'user', 'pre-signed URL', 'sync', 'Valid for a few minutes, for one object.'],
      ['user', 's3', 'PUT photo', 'sync', 'The photo goes straight to S3.'],
      ['user', 'cdn', 'GET image', 'sync', 'Views are served from the edge.'],
      ['cdn', 's3', 'cache miss', 'sync', 'Only the first view near each edge reaches S3.'],
      ['cdn', 'user', 'image', 'sync', 'Back to the browser.'],
      ['app', 'ebs', 'block reads + writes', 'sync', 'Postgres writes its data files to the disk.'],
      ['ebs', 's3', 'nightly snapshot', 'async', 'Incremental snapshots that AWS stores in S3.'],
      ['cms', 'efs', 'NFS mount', 'sync', 'A shared mount: all containers see the same files.'],
      ['s3', 'glacier', 'after 1 year', 'async', 'A lifecycle rule moves objects after 365 days. Automatic, no code.'],
      ['s3', 'fsx', 'lazy-load dataset', 'async', 'Files load from S3 on first access.'],
      ['train', 'fsx', 'read fast', 'sync', 'Reads training batches at high throughput, so GPUs never wait on data.'],
      ['train', 's3', 'checkpoints', 'sync', 'Checkpoints and the final model land back in S3.']
    ],
    flow: [
      ['Upload a photo', 'The API hands out a pre-signed URL and the photo goes directly to S3.', 'user>app, app>user, user>s3', 'write'],
      ['View a photo', 'CloudFront serves the image from the edge and fetches from S3 only on a miss.', 'user>cdn, cdn>s3, cdn>user', 'read'],
      ['Database writes to disk', 'Postgres on EC2 needs a real block device: EBS. Snapshots back it up.', 'app>ebs, ebs>s3', 'write'],
      ['CMS containers share files', 'Ten containers mount one EFS file system.', 'cms>efs', 'write'],
      ['Train a model', 'FSx for Lustre streams the dataset from S3 to the GPUs at high speed; checkpoints go back to S3.', 's3>fsx, train>fsx, train>s3', 'background'],
      ['Archive old photos', 'A lifecycle rule moves year-old originals to Glacier Deep Archive.', 's3>glacier', 'background']
    ],
    why: [
      'Large files never pass through your servers: pre-signed URLs send them straight to S3.',
      'Each kind of storage matches an access pattern: by name over HTTP (S3), a disk for one machine (EBS), a shared folder (EFS), extreme throughput (FSx).',
      'S3 is the hub: snapshots, archives, datasets, and models all end up there.'
    ],
    tradeoffs: [
      'EFS is convenient but costs about 10× S3 per GB; use it only for files that really must be shared as a file system.',
      'EBS lives in one zone; the database needs replication or snapshots to survive a zone failure.',
      'Glacier is cheap to store but slow and costly to retrieve; pick the storage class by how often you read.'
    ],
    sources: [['AWS decision guides: storage', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/storage-databases.html'],
      ['Amazon S3 storage classes', 'https://aws.amazon.com/s3/storage-classes/']]
  }
});

AWS_LESSONS.push({
  id: 'aws-databases', group: 'core', title: 'Databases: RDS vs Aurora vs DynamoDB vs ElastiCache',
  question: 'Which database fits my data?',
  summary: 'Pick by how you read the data. SQL with joins and transactions: RDS, or Aurora when you need more scale and faster failover. Known lookups by key at huge or spiky scale: DynamoDB. The same reads over and over: ElastiCache in front of the database. Search and analytics get their own engines (OpenSearch, Redshift).',
  services: ['rds', 'aurora', 'dynamodb', 'elasticache', 'opensearch', 'redshift'],
  decide: [
    ['Relational data with joins and transactions, at normal scale', ['rds'], 'PostgreSQL or MySQL, managed. The safe default.'],
    ['The same, but you need many replicas, fast failover, storage that grows itself, or serverless scaling', ['aurora'], 'Up to 15 low-lag replicas, failover usually under 30 seconds, Serverless v2.'],
    ['You know your queries up front (get by key) and need massive or spiky scale', ['dynamodb'], 'Single-digit milliseconds at any size, no servers, pay per request.'],
    ['The same reads over and over, needing sub-millisecond answers', ['elasticache'], 'A cache in front of the database, not the source of truth.'],
    ['Full-text or vector search', ['opensearch'], 'Relevance ranking, typo tolerance, facets, and vector search.'],
    ['Analytics across billions of rows', ['redshift'], 'Keep heavy queries off the production database.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['rds', 'aurora', 'dynamodb', 'elasticache'],
    rows: [
      ['Data model', ['SQL tables', 'SQL tables (Postgres/MySQL compatible)', 'Key-value and documents', 'In-memory key-value']],
      ['Scaling', ['One writer; bigger instance + read replicas', 'One writer; 15 fast replicas; storage grows itself', 'Practically unlimited; partitions automatically', 'Shards across memory nodes']],
      ['Typical latency', ['Milliseconds', 'Milliseconds', 'Single-digit ms (µs with DAX)', 'Sub-millisecond']],
      ['You pay for', ['Instance hours + storage', 'Instance or ACU hours + storage + I/O', 'Requests (or capacity) + storage', 'Node hours, or Serverless usage']],
      ['Watch out for', ['Writes scale only vertically', 'Costs more than RDS', 'Design keys up front; no joins', 'Memory is pricey; not durable on its own']]
    ]
  },
  examples: [
    ['An internal HR app: employees, departments, payroll joins', ['rds'], 'Relational data, modest traffic, lots of joins and reports.', 'DynamoDB would make every new report a redesign.'],
    ['A SaaS on Postgres that needs 10 read replicas and quick failover', ['aurora'], 'Replicas share storage and stay close behind; failover is fast.', 'Plain RDS replicas lag more and fail over more slowly.'],
    ['Shopping carts on a flash-sale day', ['dynamodb'], 'Millions of writes per second, always fetched by user id.', 'A single relational writer becomes the bottleneck.'],
    ['A product page read 50,000 times a second that changes hourly', ['elasticache', 'aurora'], 'The cache absorbs ~99% of reads; Aurora stays the source of truth.', 'Sending every read to the database needs a far bigger, costlier cluster.'],
    ['A real-time game leaderboard', ['elasticache'], 'Sorted sets give rank and top-N instantly.', 'ORDER BY on every view is slow at scale.'],
    ['Embeddings for RAG next to your existing customer tables', ['aurora'], 'pgvector keeps vectors and rows together, filtered with plain SQL.', 'A separate vector database is one more system to keep in sync.']
  ],
  quiz: [
    ['A banking ledger needs multi-row transactions and SQL reports.', ['DynamoDB', 'Aurora or RDS', 'ElastiCache', 'S3'], 1, 'Relational databases give ACID transactions and flexible SQL.'],
    ['A game stores player profiles by playerId and sees 500,000 requests per second at launch.', ['RDS MySQL', 'DynamoDB', 'Redshift', 'EFS'], 1, 'Key-value access at huge, spiky scale is DynamoDB’s sweet spot.'],
    ['Database CPU is pegged by the same 1,000 product reads.', ['Add ElastiCache in front', 'Move to Glacier', 'Add NAT gateways', 'Use Redshift'], 0, 'A cache absorbs repeated reads in memory.'],
    ['Dev databases sit idle every night and weekend.', ['Aurora Serverless v2', 'A bigger RDS instance', 'Provisioned DynamoDB at max capacity', 'Postgres on EC2'], 0, 'Serverless v2 scales down, even to zero, when idle.'],
    ['Users need to search products by keyword, with typos.', ['DynamoDB Scan', 'OpenSearch', 'SQS', 'Athena'], 1, 'OpenSearch is built for relevance-ranked, typo-tolerant text search.']
  ],
  map: {
    title: 'Online store: the right database for each job',
    subtitle: 'Cache for hot reads · Aurora for orders · DynamoDB for carts · OpenSearch for search · Redshift for reports',
    layers: ['Client', 'Gateway', 'Compute', 'Data', 'Analytics'],
    nodes: [
      ['user', 'users', 'Shoppers', 'Client', 'People browsing, adding to cart, and checking out.'],
      ['analyst', 'users', 'Analysts', 'Client', 'The finance team building sales dashboards.'],
      ['alb', 'elb', 'ALB', 'Gateway', 'Spreads requests across the store API containers.'],
      ['api', 'fargate', 'Store API', 'Compute', 'Containers that use each database for the job it does best.'],
      ['cache', 'elasticache', 'Product cache', 'Data', 'Valkey in memory: about half-millisecond reads for hot product pages.'],
      ['writer', 'aurora', 'Orders · writer', 'Data', 'The Aurora PostgreSQL writer. Orders and payments need ACID transactions.'],
      ['replica', 'aurora', 'Read replicas', 'Data', 'Share the writer’s storage and typically lag under 100 ms. They serve product reads that miss the cache.', 'Aurora replicas'],
      ['carts', 'dynamodb', 'Carts + sessions', 'Data', 'Key = userId. Handles flash-sale spikes with no capacity planning (on-demand mode).'],
      ['search', 'opensearch', 'Product search', 'Data', 'Full-text search with typo tolerance and facets ("red shoes under $50").'],
      ['rs', 'redshift', 'Sales warehouse', 'Analytics', 'A columnar warehouse for dashboards, fed by zero-ETL, so there are no pipelines to write.']
    ],
    edges: [
      ['user', 'alb', 'HTTPS', 'sync', 'All store traffic.'],
      ['alb', 'api', 'forward', 'sync', 'To a healthy container.'],
      ['api', 'cache', 'GET product', 'sync', 'Memory first.'],
      ['cache', 'api', 'hit (~0.5 ms)', 'sync', 'Most product reads end here.'],
      ['api', 'replica', 'miss → read', 'sync', 'Only misses reach the database.'],
      ['api', 'writer', 'transaction', 'sync', 'Place the order: insert it, decrement stock, record payment, all or nothing.'],
      ['writer', 'replica', 'replicate', 'async', 'Shared storage keeps replicas close behind.'],
      ['api', 'carts', 'by userId', 'sync', 'Get or put the cart by user id: single-digit milliseconds at any scale.'],
      ['api', 'search', 'search', 'sync', 'Ranked, typo-tolerant results.'],
      ['writer', 'search', 'sync catalog changes', 'async', 'A pipeline keeps the index current.'],
      ['writer', 'rs', 'zero-ETL', 'async', 'Changes replicate into Redshift automatically.'],
      ['carts', 'rs', 'zero-ETL', 'async', 'DynamoDB changes flow in too.'],
      ['analyst', 'rs', 'SQL dashboards', 'sync', 'Heavy queries never touch production.'],
      ['alb', 'user', 'page', 'sync', 'The response to the shopper.']
    ],
    flow: [
      ['View a product (cache hit)', 'Hot data comes from memory in under a millisecond.', 'user>alb, alb>api, api>cache, cache>api, alb>user', 'read'],
      ['View a product (cache miss)', 'A miss reads from an Aurora replica, not the writer.', 'user>alb, alb>api, api>cache, api>replica, alb>user', 'read'],
      ['Add to cart', 'A key-value write to DynamoDB, fast at any scale.', 'user>alb, alb>api, api>carts, alb>user', 'write'],
      ['Check out', 'One ACID transaction on the Aurora writer; replicas catch up.', 'user>alb, alb>api, api>writer, writer>replica, alb>user', 'write'],
      ['Search the catalog', 'OpenSearch handles relevance, typos, and facets.', 'user>alb, alb>api, api>search, alb>user', 'read'],
      ['Morning sales report', 'Zero-ETL copies data into Redshift, and analysts query there.', 'writer>rs, carts>rs, analyst>rs', 'background']
    ],
    why: [
      'Each store matches one access pattern, so none of them is stretched past what it is good at.',
      'The cache and the replicas absorb reads, so the writer only handles writes.',
      'Carts move to DynamoDB because they are always fetched by user id and spike hard on sale days.',
      'Analytics run on Redshift, so a heavy report can never slow down checkout.'
    ],
    tradeoffs: [
      'More databases means more systems to secure, monitor, and keep consistent.',
      'Cache and search index are eventually consistent: a price change can take a moment to show.',
      'DynamoDB needs its queries designed up front; a new access pattern may need a new index or table.'
    ],
    sources: [['AWS decision guide: choosing a database', 'https://docs.aws.amazon.com/decision-guides/latest/decision-guides/databases-on-aws-how-to-choose.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-messaging', group: 'core', title: 'Messaging: SQS vs SNS vs EventBridge vs Kinesis',
  question: 'How do my services talk without waiting on each other?',
  summary: 'SQS is a to-do list that workers drain at their own pace. SNS shouts one message to every subscriber. EventBridge reads each event and routes it by content. Kinesis is a replayable log of events in order. Step Functions runs a multi-step process with retries and waits. They are often combined (SNS → SQS, EventBridge → Step Functions).',
  services: ['sqs', 'sns', 'eventbridge', 'kinesis', 'firehose', 'stepfunctions'],
  decide: [
    ['One kind of work, done once, at the worker’s pace', ['sqs'], 'A buffer with retries and a dead-letter queue. Use FIFO when order matters.'],
    ['One message, many subscribers, pushed right away', ['sns'], 'Fan-out. Put an SQS queue behind each subscriber that must not miss messages.'],
    ['Route events by content to many targets, react to AWS or SaaS events, or run schedules', ['eventbridge'], 'The decoupling layer between teams.'],
    ['A high-volume, ordered stream that several readers consume and can replay', ['kinesis'], 'Clicks, IoT, logs. Amazon MSK if you want Kafka.'],
    ['A multi-step process with branches, retries, waits, and human approval', ['stepfunctions'], 'A workflow with a full history of every run.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['sqs', 'sns', 'eventbridge', 'kinesis', 'stepfunctions'],
    rows: [
      ['Pattern', ['Queue (workers pull)', 'Pub/sub (pushes)', 'Event bus + rules', 'Ordered stream (a log)', 'Workflow (state machine)']],
      ['Who receives', ['One worker per message', 'Every subscriber', 'Every matching rule’s targets', 'Every reader, at its own position', 'Each step you define']],
      ['Keeps messages', ['Up to 14 days', 'No (delivers now)', 'Only with archive on', '24 hours to 365 days, replayable', 'Run history']],
      ['Ordering', ['FIFO queues only', 'FIFO topics only', 'None', 'Per shard', 'Your step order']],
      ['Best at', ['Buffering, retries, smoothing spikes', 'Fast fan-out, notifications', 'Decoupling teams, SaaS/AWS events, cron', 'Real-time analytics at high volume', 'Sagas, long processes, approvals']]
    ]
  },
  examples: [
    ['Send a welcome email after sign-up without slowing sign-up', ['sqs', 'lambda'], 'The API enqueues and returns; a worker sends the email with retries and a dead-letter queue.', 'Sending inline makes sign-up fail whenever the email provider is slow.'],
    ['"Order placed" must reach billing, shipping, and analytics', ['eventbridge', 'sns', 'sqs'], 'EventBridge when teams own their own rules or filter by content (orders over $500 → fraud review). SNS → SQS for the simplest, fastest fan-out.', 'Calling three services directly couples the order API to all of them.'],
    ['200,000 click events per second for live dashboards, with replay', ['kinesis', 'firehose'], 'An ordered stream that several consumers read; Firehose lands it in S3.', 'SQS has no replay, and each message goes to only one consumer.'],
    ['Loan application: verify ID → credit check → wait days for an underwriter → send documents', ['stepfunctions'], 'Standard workflows can wait up to a year and pause for a human callback.', 'Chaining functions through queues hides the state and makes failures hard to trace.'],
    ['Run a cleanup job every night at 2 AM', ['eventbridge', 'lambda'], 'EventBridge Scheduler invokes the function on a cron schedule.', 'A server that exists only to run cron wastes money.'],
    ['Payments processed in order per account, with no duplicates', ['sqs'], 'An SQS FIFO queue with the account id as the message group.', 'Standard queues may reorder or repeat messages.']
  ],
  quiz: [
    ['Three independent services must each get every "UserSignedUp" event, and none may miss one.', ['One SQS queue shared by all three', 'An SNS topic with an SQS queue per service', 'One Lambda calling all three', 'Route 53'], 1, 'Fan-out with a durable queue per consumer, so a slow or down consumer does not lose messages.'],
    ['You must re-process yesterday’s events after fixing a bug.', ['SQS Standard', 'SNS', 'Kinesis Data Streams', 'API Gateway'], 2, 'Streams keep records (24 hours to a year) and consumers can rewind.'],
    ['Only orders from VIP customers should trigger the concierge service.', ['An EventBridge rule with a content filter', 'SQS visibility timeout', 'A CloudFront behavior', 'A bigger Lambda'], 0, 'EventBridge rules match on fields inside the event.'],
    ['A process waits up to three days for a manager to approve a refund.', ['A Lambda with a long sleep', 'A Step Functions Standard workflow with a callback', 'An SQS delay queue', 'Kinesis'], 1, 'Standard workflows can pause for a callback for up to a year.'],
    ['Traffic spikes 20× for ten minutes and the downstream API can only take 100 requests per second.', ['An SQS queue in between', 'Remove retries', 'SNS', 'CloudTrail'], 0, 'The queue absorbs the spike and workers drain it at a safe rate.']
  ],
  map: {
    title: 'Order pipeline: four ways to pass a message',
    subtitle: 'EventBridge routes · SNS fans out · SQS buffers · Kinesis streams · Step Functions orchestrates',
    layers: ['Client', 'Compute', 'Events', 'Queues', 'Workers', 'Data'],
    nodes: [
      ['user', 'users', 'Shopper', 'Client', 'Places orders and generates click events.'],
      ['api', 'fargate', 'Order API', 'Compute', 'Saves the order, publishes one event, and answers immediately.'],
      ['bus', 'eventbridge', 'Order events bus', 'Events', 'Rules route "OrderPlaced" to every interested team, based on the event’s content.'],
      ['topic', 'sns', 'Notify customer', 'Events', 'Fans one message out to email and to SMS or push.'],
      ['stream', 'kinesis', 'Clickstream', 'Events', 'An ordered, replayable stream of every click.'],
      ['billingq', 'sqs', 'Billing queue', 'Queues', 'Buffers charges so the payment worker runs at a steady pace; retries and a dead-letter queue catch failures.'],
      ['emailq', 'sqs', 'Email queue', 'Queues', 'Buffers emails; failures retry, and messages that keep failing go to a dead-letter queue.'],
      ['firehose', 'firehose', 'Batch clicks to S3', 'Queues', 'Buffers clicks and writes Parquet files about every minute.'],
      ['billing', 'lambda', 'Charge card', 'Workers', 'Processes billing messages in batches of 10.'],
      ['email', 'lambda', 'Send email', 'Workers', 'Sends the order confirmation.'],
      ['fraud', 'lambda', 'Fraud check (> $500)', 'Workers', 'Only large orders reach it, thanks to an EventBridge content filter.'],
      ['saga', 'stepfunctions', 'Fulfilment workflow', 'Workers', 'Reserve stock → pick → ship → notify, with retries and a compensating refund if shipping fails.'],
      ['db', 'dynamodb', 'Orders table', 'Data', 'Order status, updated by each step.'],
      ['lake', 's3', 'Click data lake', 'Data', 'Parquet files for analytics.']
    ],
    edges: [
      ['user', 'api', 'POST /orders', 'sync', 'The shopper places an order.'],
      ['api', 'db', 'save order', 'sync', 'Durable before anything else happens.'],
      ['api', 'bus', 'OrderPlaced', 'async', 'One publish; the API does not know who listens.'],
      ['api', 'user', 'order id', 'sync', 'The response does not wait for billing or email.'],
      ['bus', 'billingq', 'rule: every order', 'async', 'Into a buffer for steady processing.'],
      ['bus', 'fraud', 'rule: total > 500', 'async', 'Content-based filtering.'],
      ['bus', 'saga', 'start workflow', 'async', 'A rule starts one fulfilment workflow run per order.'],
      ['bus', 'topic', 'notify', 'async', 'A rule hands the event to SNS for fan-out to the customer.'],
      ['topic', 'emailq', 'subscribe', 'async', 'The email path, buffered by a subscribed queue.'],
      ['topic', 'user', 'SMS / push', 'async', 'Straight to the phone.'],
      ['billingq', 'billing', 'poll ×10', 'async', 'Lambda pulls messages in batches of 10.'],
      ['emailq', 'email', 'poll', 'async', 'Lambda pulls messages.'],
      ['billing', 'db', 'mark paid', 'sync', 'Status update.'],
      ['saga', 'db', 'update status', 'sync', 'Each step records progress.'],
      ['user', 'stream', 'click events', 'async', 'The app sends every click.'],
      ['stream', 'firehose', 'read shard', 'async', 'One of many possible consumers.'],
      ['firehose', 'lake', 'Parquet', 'async', 'Batched Parquet files, about every minute.']
    ],
    flow: [
      ['Place an order', 'The API saves the order, publishes one event, and answers. Nothing else is on the user’s path.', 'user>api, api>db, api>bus, api>user', 'write'],
      ['Route the event (EventBridge)', 'Rules match on content and send copies to billing, fraud, fulfilment, and notifications.', 'api>bus, bus>billingq, bus>fraud, bus>saga, bus>topic', 'background'],
      ['Charge the card (SQS buffer)', 'Billing drains its queue at a steady rate; failures retry, then land in a dead-letter queue.', 'billingq>billing, billing>db', 'background'],
      ['Notify the customer (SNS fan-out)', 'One message becomes a buffered email and an SMS or push.', 'topic>emailq, emailq>email, topic>user', 'background'],
      ['Fulfil the order (Step Functions)', 'A workflow runs each step in order, with retries and a compensating refund.', 'bus>saga, saga>db', 'background'],
      ['Stream clicks (Kinesis)', 'Clicks are an ordered, replayable stream; Firehose lands them in S3.', 'user>stream, stream>firehose, firehose>lake', 'write']
    ],
    why: [
      'The user waits only for the order to be saved; everything else happens after the response.',
      'EventBridge lets each team add a rule without changing the order API.',
      'An SQS queue in front of each slow consumer turns traffic spikes into a backlog instead of an outage.',
      'Clicks use a stream because analytics, fraud, and the archive all need every event, in order, with replay.'
    ],
    tradeoffs: [
      'Asynchronous means eventually consistent: the order page may say "processing" for a few seconds.',
      'At-least-once delivery means duplicates: every consumer must be idempotent.',
      'More hops make debugging harder; trace ids and dead-letter queue alarms are essential.'
    ],
    sources: [['AWS decision guide: application integration', 'https://aws.amazon.com/getting-started/decision-guides/application-integration-on-aws-how-to-choose/']]
  }
});

AWS_LESSONS.push({
  id: 'aws-networking', group: 'core', title: 'The front door: CloudFront, ALB, API Gateway, VPC',
  question: 'How does a request get from a user to my code, safely?',
  summary: 'Route 53 finds you, CloudFront serves what it can from the edge, WAF blocks attacks, and an ALB or API Gateway hands the rest to your code. Inside, a VPC keeps the app and database in private subnets, with a NAT gateway for outbound calls and VPC endpoints for private access to AWS services.',
  services: ['route53', 'cloudfront', 'waf', 'elb', 'apigateway', 'vpc'],
  decide: [
    ['Domain names, health-checked failover, routing by latency or location', ['route53'], 'The first hop of every request.'],
    ['Anything users download, or users far from your region', ['cloudfront'], 'Caches at the edge, cuts latency and transfer cost, and absorbs spikes.'],
    ['HTTP traffic to containers or EC2 at steady volume', ['elb'], 'An ALB is the cheapest per request at scale and supports WebSockets and long requests. Use an NLB for raw TCP/UDP and static IPs.'],
    ['APIs that need keys, quotas, per-client throttling, or sit in front of Lambda', ['apigateway'], 'Auth, throttling, and usage plans without writing them yourself.'],
    ['Keeping the app and database off the internet', ['vpc'], 'Private subnets and security groups; a NAT gateway for outbound calls; VPC endpoints for AWS services.'],
    ['Blocking attacks and abusive traffic', ['waf'], 'Attach WAF to CloudFront, the ALB, or API Gateway.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['cloudfront', 'elb', 'apigateway', 'route53'],
    rows: [
      ['Job', ['Cache and deliver content at the edge', 'Spread traffic across healthy servers', 'Manage and protect APIs', 'Answer DNS and steer traffic']],
      ['Works at', ['HTTP, worldwide', 'HTTP (ALB) or TCP/UDP (NLB), per region', 'HTTP, REST, WebSocket, per region', 'DNS, worldwide']],
      ['Built-in auth', ['Signed URLs and cookies', 'OIDC / Cognito on the ALB', 'IAM, Cognito JWT, Lambda authorizers, API keys', '—']],
      ['You pay for', ['GB delivered + requests', 'Hours + capacity units', 'Per million requests', 'Hosted zones + queries']],
      ['Watch out for', ['Cache invalidation takes time', 'Regional only', '29 s default timeout, 10 MB payloads', 'DNS caching slows failover']]
    ]
  },
  examples: [
    ['A React single-page app with users worldwide', ['s3', 'cloudfront'], 'Files cached at hundreds of edges, and no servers.', 'Serving from one region adds 100+ ms for distant users.'],
    ['1,000 requests per second, all day, to ECS containers', ['elb'], 'At about 2.6 billion requests a month an ALB costs hundreds of dollars; API Gateway would cost thousands.', 'API Gateway’s per-request price adds up at steady high volume.'],
    ['A public partner API with keys and per-customer quotas', ['apigateway', 'lambda'], 'Usage plans and API keys are built in.', 'An ALB has no concept of API keys or quotas.'],
    ['Multiplayer game servers on UDP', ['elb'], 'A Network Load Balancer handles UDP with static IPs.', 'An ALB and CloudFront only speak HTTP.'],
    ['Fail over to a second region if the first is down', ['route53'], 'Failover routing with health checks.', 'A load balancer cannot route between regions.'],
    ['A Lambda function in a VPC writes 5 TB a month to S3', ['vpc'], 'A free S3 gateway endpoint keeps that traffic off the NAT gateway.', 'Through a NAT gateway, 5 TB adds roughly $225 in processing charges.']
  ],
  quiz: [
    ['Your database should never be reachable from the internet. Where does it go?', ['A public subnet with a strong password', 'A private subnet with a security group that allows only the app', 'Behind CloudFront', 'In Route 53'], 1, 'Network isolation plus security groups means there is no path from the internet at all.'],
    ['Private ECS tasks must call the Stripe API.', ['Give each task a public IP', 'A NAT gateway', 'VPC peering with Stripe', 'Route 53'], 1, 'A NAT gateway allows outbound internet calls from private subnets without allowing inbound ones.'],
    ['Which service lets you give partners API keys with monthly quotas?', ['ALB', 'API Gateway', 'NLB', 'CloudFront'], 1, 'API Gateway usage plans attach quotas and throttling to API keys.'],
    ['Users in Australia say your US-hosted images load slowly.', ['Bigger EC2 instances', 'CloudFront', 'More read replicas', 'Step Functions'], 1, 'CloudFront caches the images at edges near Australian users.']
  ],
  map: {
    title: 'A request’s path through the edge and a VPC',
    subtitle: 'Public: DNS, WAF, CDN, load balancer · Private: app · Isolated: database · NAT for outbound · endpoint for S3',
    layers: ['Client', 'Edge', 'Gateway', 'Compute', 'Network', 'Data'],
    nodes: [
      ['user', 'users', 'Browser', 'Client', 'A customer opening the app.'],
      ['partner', 'saas', 'Partner system', 'Client', 'A partner calling your API with an API key.', 'Partner'],
      ['dns', 'route53', 'app.example.com', 'Edge', 'Answers DNS and can fail over to another region using health checks.'],
      ['waf', 'waf', 'Bot + SQLi rules', 'Edge', 'Inspects every request at the edge and blocks attacks and floods.'],
      ['cdn', 'cloudfront', 'Edge cache', 'Edge', 'Serves static files from S3 and forwards /api/* to the load balancer.'],
      ['alb', 'elb', 'ALB · public subnets', 'Gateway', 'The only part of the web path with a public address.'],
      ['apigw', 'apigateway', 'Partner API (keys)', 'Gateway', 'API keys, usage plans, and throttling for partners.'],
      ['svc', 'fargate', 'App · private subnet', 'Compute', 'No public IP. Reachable only through the load balancer.'],
      ['fn', 'lambda', 'Partner handler', 'Compute', 'Runs inside the VPC so it can reach the database.'],
      ['nat', 'vpc', 'Outbound to internet', 'Network', 'Lets private resources call out (to Stripe) while blocking inbound connections. Billed per hour and per GB.', 'NAT gateway'],
      ['vpce', 'vpc', 'S3 gateway endpoint', 'Network', 'A private route to S3 inside AWS. Free, and it keeps S3 traffic off the NAT gateway.', 'VPC endpoint'],
      ['db', 'rds', 'Postgres · isolated', 'Data', 'No route to the internet at all. Its security group allows port 5432 only from the app.'],
      ['s3', 's3', 'Static files + exports', 'Data', 'A private bucket; CloudFront reads it through Origin Access Control.'],
      ['stripe', 'saas', 'Stripe API', 'Data', 'A third-party API on the internet.', 'Stripe']
    ],
    edges: [
      ['user', 'dns', 'resolve name', 'sync', 'Returns the CloudFront address.'],
      ['user', 'waf', 'HTTPS request', 'sync', 'Filtered at the edge first.'],
      ['waf', 'cdn', 'allowed traffic', 'sync', 'Bad requests never reach your origin.'],
      ['cdn', 's3', 'static files (OAC)', 'sync', 'Only CloudFront may read the bucket.'],
      ['cdn', 'alb', '/api/*', 'sync', 'Dynamic requests go to the load balancer.'],
      ['alb', 'svc', 'target group', 'sync', 'Health-checked tasks in private subnets.'],
      ['svc', 'db', 'SQL :5432', 'sync', 'Allowed by security group rules.'],
      ['svc', 'nat', 'outbound HTTPS', 'sync', 'Private tasks have no public IP.'],
      ['nat', 'stripe', 'charge card', 'sync', 'Leaves through the NAT gateway’s public IP.'],
      ['svc', 'vpce', 'write export', 'sync', 'Routed privately.'],
      ['vpce', 's3', 'private route', 'sync', 'Never touches the internet or the NAT gateway.'],
      ['partner', 'apigw', 'API key', 'sync', 'Throttled per key.'],
      ['apigw', 'fn', 'invoke', 'sync', 'The function runs in the VPC.'],
      ['fn', 'db', 'query', 'sync', 'The same security group rules apply.'],
      ['cdn', 'user', 'response', 'sync', 'Back through the edge.']
    ],
    flow: [
      ['Open the app', 'DNS → WAF → CloudFront → S3 for the static files.', 'user>dns, user>waf, waf>cdn, cdn>s3, cdn>user', 'read'],
      ['Call the API', 'CloudFront forwards /api to the ALB, which sends it to a private task that queries the isolated database.', 'user>waf, waf>cdn, cdn>alb, alb>svc, svc>db, cdn>user', 'read'],
      ['Call a third-party API', 'Private tasks go out through the NAT gateway; nothing can come in that way.', 'svc>nat, nat>stripe', 'write'],
      ['Write to S3 privately', 'A gateway endpoint routes S3 traffic inside AWS, for free.', 'svc>vpce, vpce>s3', 'write'],
      ['Partner calls your API', 'API Gateway checks the key and throttles; a Lambda function in the VPC queries the database.', 'partner>apigw, apigw>fn, fn>db', 'write']
    ],
    why: [
      'Only the edge and the load balancer are public; the app and database have no public addresses.',
      'Security groups allow just the next hop: users → ALB → app → database, nothing else.',
      'Outbound calls go through a NAT gateway, and AWS service traffic stays private through endpoints.',
      'WAF and CloudFront take the brunt of attacks and spikes before they reach your region.'
    ],
    tradeoffs: [
      'NAT gateways cost per hour and per GB; heavy outbound traffic can surprise you on the bill.',
      'CloudFront caching makes content fast but slow to change; plan cache keys and invalidations.',
      'API Gateway adds per-request cost and a timeout; an ALB is cheaper for steady internal-facing traffic.'
    ],
    sources: [['Amazon VPC user guide', 'https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-security', group: 'core', title: 'Security: IAM vs Cognito vs KMS vs Secrets Manager',
  question: 'Who can do what, and how is data protected?',
  summary: 'IAM controls what your code and engineers can do inside AWS. Cognito signs in your app’s customers. KMS holds the encryption keys. Secrets Manager holds passwords and API keys. WAF filters web traffic, and CloudTrail records who did what. The most common mistake is mixing up IAM (for AWS) and Cognito (for your users).',
  services: ['iam', 'cognito', 'kms', 'secrets', 'waf', 'cloudtrail'],
  decide: [
    ['Your code or your engineers need permission to use AWS', ['iam'], 'Roles with least privilege. No long-lived access keys.'],
    ['Your app’s customers sign up, sign in, use MFA or social login', ['cognito'], 'Issues JWTs that API Gateway or an ALB can verify.'],
    ['Data must be encrypted with keys you control, with every use audited', ['kms'], 'Customer managed keys on S3, RDS, DynamoDB, EBS.'],
    ['Passwords and API keys used by code', ['secrets'], 'Stored encrypted, rotated automatically, fetched at runtime.'],
    ['Attacks and abuse against web endpoints', ['waf'], 'Managed rules, rate limits, and bot control; Shield for DDoS.'],
    ['Proving who did what in the account', ['cloudtrail'], 'An audit log of every API call.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['iam', 'cognito', 'kms', 'secrets', 'waf'],
    rows: [
      ['Protects', ['Access to AWS APIs', 'Your app’s sign-in', 'Data at rest (keys)', 'Credentials used by code', 'Web endpoints']],
      ['Used by', ['Engineers and services', 'Your customers', 'AWS data services, your code', 'Your code at runtime', 'CloudFront, ALB, API Gateway']],
      ['You pay', ['Free', 'Per monthly active user', '~$1/key/month + requests', '~$0.40/secret/month + calls', 'Per rule + requests']],
      ['Common mistake', ['Wildcard policies, using root', 'Using IAM users for customers', 'One key for everything', 'Secrets in env vars or git', 'No rate-based rules']]
    ]
  },
  examples: [
    ['A Lambda function must read one S3 bucket', ['iam'], 'An execution role with s3:GetObject on that bucket only.', 'Access keys in environment variables leak and never expire.'],
    ['A mobile app needs Apple and Google sign-in plus MFA', ['cognito'], 'User pools handle federation and MFA and issue JWTs.', 'IAM users are for people operating AWS, not customers.'],
    ['Health data must be encrypted with a key the company can revoke', ['kms'], 'A customer managed key on S3 and RDS; disabling it cuts off access.', 'You cannot disable AWS managed keys yourself.'],
    ['The database password must rotate every 30 days', ['secrets'], 'Built-in rotation updates the database and the secret together.', 'A password in a config file never changes and leaks with the repo.'],
    ['The login page is hit by credential stuffing', ['waf', 'cognito'], 'WAF rate-based rules and Bot Control at the edge, plus Cognito threat protection on sign-in.', 'Adding servers just lets attackers try more passwords.'],
    ['Employees sign into the AWS console with company SSO', ['iam'], 'IAM Identity Center connects to Okta or Entra ID.', 'Cognito is for your app’s customers, not your engineers.']
  ],
  quiz: [
    ['What is the right way to give an app on EC2 access to DynamoDB?', ['Hard-code access keys', 'Attach an IAM role (instance profile)', 'Store keys in S3', 'Use the root account'], 1, 'Roles hand out temporary credentials automatically.'],
    ['Your customers need to sign up with email and MFA.', ['IAM users', 'A Cognito user pool', 'KMS', 'Secrets Manager'], 1, 'Cognito manages customer identities and issues tokens.'],
    ['An auditor asks who disabled encryption on a bucket last month.', ['CloudWatch metrics', 'CloudTrail', 'X-Ray', 'WAF logs'], 1, 'CloudTrail records the API call, who made it, and when.'],
    ['A third-party API key is used by five Lambda functions.', ['Copy it into each function’s code', 'Secrets Manager', 'A public S3 bucket', 'Cognito'], 1, 'One encrypted, rotatable secret fetched at runtime.']
  ],
  map: {
    title: 'A secure records API: identity, keys, audit',
    subtitle: 'Cognito for customers · IAM for code · Secrets Manager for passwords · KMS for encryption · CloudTrail for audit',
    layers: ['Client', 'Edge', 'Gateway', 'Compute', 'Security', 'Data', 'Obs'],
    nodes: [
      ['user', 'users', 'Mobile app user', 'Client', 'A customer using the app.'],
      ['waf', 'waf', 'Rate + bot rules', 'Edge', 'Stops credential stuffing and floods before they reach the API.'],
      ['apigw', 'apigateway', 'Checks the JWT', 'Gateway', 'Rejects any request without a valid token from the user pool.'],
      ['cognito', 'cognito', 'User pool (sign-in)', 'Gateway', 'Sign-up, sign-in, MFA, and "Sign in with Apple". Issues JWTs.'],
      ['fn', 'lambda', 'Records API', 'Compute', 'The business logic. It holds no stored keys of any kind.'],
      ['role', 'iam', 'Execution role', 'Security', 'Grants exactly: read one secret, reach one database, read one bucket prefix.', 'IAM role'],
      ['secret', 'secrets', 'DB password', 'Security', 'Rotated automatically every 30 days.'],
      ['kms', 'kms', 'Customer managed key', 'Security', 'Encrypts the secret, the bucket, and the database. Disable it and the data becomes unreadable.'],
      ['db', 'rds', 'Patient records', 'Data', 'Encrypted at rest with the KMS key; TLS in transit.'],
      ['s3', 's3', 'Documents (SSE-KMS)', 'Data', 'Each object is encrypted with a data key protected by KMS.'],
      ['trail', 'cloudtrail', 'Audit log', 'Obs', 'Every API call and every key use, kept for audits.']
    ],
    edges: [
      ['user', 'cognito', 'sign in + MFA', 'sync', 'Password plus a one-time code.'],
      ['cognito', 'user', 'JWT tokens', 'sync', 'Short-lived ID and access tokens.'],
      ['user', 'waf', 'API call + JWT', 'sync', 'Filtered at the edge.'],
      ['waf', 'apigw', 'allowed', 'sync', 'Only clean traffic gets through.'],
      ['apigw', 'cognito', 'verify token', 'sync', 'The signature is checked against the user pool’s public keys.'],
      ['apigw', 'fn', 'invoke', 'sync', 'Only with a valid token.'],
      ['fn', 'role', 'temporary credentials', 'sync', 'The function runs with the role’s short-lived credentials; there are no keys in code.'],
      ['fn', 'secret', 'get DB password', 'sync', 'Cached for a few minutes.'],
      ['secret', 'kms', 'decrypt', 'sync', 'Secrets Manager asks KMS to unwrap the secret.'],
      ['fn', 'db', 'query over TLS', 'sync', 'An encrypted connection.'],
      ['fn', 's3', 'get document', 'sync', 'Allowed for one prefix only.'],
      ['s3', 'kms', 'decrypt data key', 'sync', 'Transparent to your code.'],
      ['fn', 'trail', 'API calls recorded', 'obs', 'Who called what.'],
      ['kms', 'trail', 'key use recorded', 'obs', 'Every decrypt is logged.'],
      ['apigw', 'user', 'response', 'sync', 'Back to the app.']
    ],
    flow: [
      ['Sign in', 'Cognito checks the password and MFA and returns short-lived JWTs.', 'user>cognito, cognito>user', 'write'],
      ['Call the API with a token', 'WAF filters, API Gateway verifies the JWT, and the function runs with an IAM role.', 'user>waf, waf>apigw, apigw>cognito, apigw>fn, fn>role, fn>db, apigw>user', 'read'],
      ['Use a secret', 'The function fetches the database password and KMS decrypts it; nothing is hard-coded.', 'fn>secret, secret>kms, fn>db', 'read'],
      ['Read an encrypted file', 'S3 asks KMS to decrypt the object’s data key, transparently.', 'fn>s3, s3>kms', 'read'],
      ['Audit trail', 'CloudTrail records every API call and every key use.', 'fn>trail, kms>trail', 'background']
    ],
    why: [
      'Customers (Cognito) and code (IAM) are separate identity systems, each with short-lived credentials.',
      'There are no secrets in code: the role grants access and the password comes from Secrets Manager at runtime.',
      'One customer managed key protects every data store, so access can be cut off in one place.',
      'CloudTrail gives auditors a complete, tamper-evident record.'
    ],
    tradeoffs: [
      'Least-privilege policies take effort to write and maintain; wildcards are tempting and dangerous.',
      'Customer managed keys add cost and the risk of locking yourself out if a key is deleted.',
      'Each extra check (WAF, token verification, decrypt) adds a little latency.'
    ],
    sources: [['IAM security best practices', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html']]
  }
});

AWS_LESSONS.push({
  id: 'aws-ops', group: 'core', title: 'Monitoring and IaC: CloudWatch, X-Ray, CloudTrail, CDK',
  question: 'How do I see what is happening, and deploy it the same way every time?',
  summary: 'CloudWatch answers "how is it running?" with metrics, logs, and alarms. X-Ray answers "where did the time go?" for one request across services. CloudTrail answers "who changed what?". CloudFormation (often written with the CDK) answers "what should exist?", so every environment is built from the same code.',
  services: ['cloudwatch', 'xray', 'cloudtrail', 'cloudformation', 'sns'],
  decide: [
    ['Is my app healthy? Metrics, logs, alarms, dashboards', ['cloudwatch'], 'Alarm on what users feel: errors, latency, queue age.'],
    ['Which hop made this request slow?', ['xray'], 'Traces across services, viewed in CloudWatch.'],
    ['Who changed what in the account?', ['cloudtrail'], 'An audit log of every API call. Not the same as app logs.'],
    ['Create the same infrastructure in every environment', ['cloudformation'], 'Templates (or CDK code) reviewed like application code.'],
    ['Wake someone up', ['sns'], 'CloudWatch alarm → SNS → PagerDuty, Slack, or email.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['cloudwatch', 'xray', 'cloudtrail', 'cloudformation'],
    rows: [
      ['Answers', ['"How is it running?"', '"Where did the time go?"', '"Who did what?"', '"What should exist?"']],
      ['Data', ['Metrics, logs, alarms', 'Traces per request', 'API call events', 'Templates and stacks']],
      ['You pay for', ['Metrics, alarms, GB of logs', 'Traces recorded and scanned', 'Data events and extra trails', 'Nothing (only what it creates)']],
      ['Common mistake', ['Keeping all logs forever at full price', 'Not passing trace headers along', 'Confusing it with app logs', 'Hand edits that cause drift']]
    ]
  },
  examples: [
    ['Know within 5 minutes when checkout errors rise', ['cloudwatch', 'sns'], 'An alarm on the error-rate metric notifies on-call through SNS.', 'Waiting for customers to complain.'],
    ['Checkout got slow, and it crosses four services', ['xray'], 'A trace shows the slow hop directly.', 'Searching four services’ logs by timestamp.'],
    ['Find out who opened a security group to the whole internet', ['cloudtrail'], 'The AuthorizeSecurityGroupIngress call, with the caller and the time.', 'CloudWatch has no record of who made API calls.'],
    ['Spin up a full copy of production for a load test, then delete it', ['cloudformation'], 'Deploy the same stack with different parameters, then delete the stack.', 'Recreating dozens of resources by hand drifts from production.']
  ],
  quiz: [
    ['Which service tells you a Lambda function’s error rate went above 2%?', ['CloudTrail', 'CloudWatch', 'IAM', 'CloudFormation'], 1, 'CloudWatch metrics and alarms track how the app is running.'],
    ['Someone deleted a production table. Which service shows who?', ['CloudWatch Logs', 'CloudTrail', 'X-Ray', 'Route 53'], 1, 'CloudTrail logs the DeleteTable call and the identity that made it.'],
    ['You want staging to be an exact copy of production’s infrastructure.', ['Click through the console carefully', 'CloudFormation or CDK', 'CloudTrail', 'Copy the server images'], 1, 'Infrastructure as code builds identical environments from the same template.']
  ],
  map: {
    title: 'Deploy, observe, alert',
    subtitle: 'Code → CloudFormation → resources · metrics, logs, traces → CloudWatch · alarms → SNS → on-call · CloudTrail for audit',
    layers: ['Client', 'Deploy', 'Compute', 'Data', 'Obs', 'Async'],
    nodes: [
      ['dev', 'users', 'Engineer (git push)', 'Client', 'Changes infrastructure by changing code, never by clicking.'],
      ['oncall', 'users', 'On-call engineer', 'Client', 'Gets paged when alarms fire.'],
      ['cfn', 'cloudformation', 'Stack (from CDK)', 'Deploy', 'The CDK app synthesizes a template; CloudFormation creates or updates every resource in order and rolls back on failure.'],
      ['api', 'lambda', 'Orders function', 'Compute', 'Emits structured logs, metrics, and trace segments.'],
      ['svc', 'fargate', 'Payments service', 'Compute', 'A container service the orders function calls.'],
      ['db', 'dynamodb', 'Orders table', 'Data', 'Created by the stack, not by hand.'],
      ['logs', 's3', 'Audit log archive', 'Data', 'CloudTrail delivers log files here for years of retention, queryable with Athena.'],
      ['cw', 'cloudwatch', 'Metrics, logs, alarms', 'Obs', 'Dashboards, plus an alarm on error rate above 1% for 5 minutes.'],
      ['xray', 'xray', 'Request traces', 'Obs', 'Shows that most of the latency sits in the payments call.'],
      ['trail', 'cloudtrail', 'Account audit trail', 'Obs', 'Records the deployment and every other API call.'],
      ['sns', 'sns', 'Alert topic', 'Async', 'Delivers the alarm to PagerDuty, Slack, and email.']
    ],
    edges: [
      ['dev', 'cfn', 'cdk deploy', 'sync', 'Reviewed in a pull request first.'],
      ['cfn', 'api', 'create / update', 'sync', 'The same code for dev, staging, and prod.'],
      ['cfn', 'svc', 'create / update', 'sync', 'A rolling deployment.'],
      ['cfn', 'db', 'create table', 'sync', 'With point-in-time recovery turned on.'],
      ['api', 'svc', 'charge', 'sync', 'A downstream call.'],
      ['api', 'db', 'write order', 'sync', 'Single-digit milliseconds.'],
      ['api', 'cw', 'logs + metrics', 'obs', 'Errors, duration, and business metrics.'],
      ['svc', 'cw', 'logs + metrics', 'obs', 'Container CPU, memory, and app logs.'],
      ['api', 'xray', 'trace segments', 'obs', 'Sampled requests.'],
      ['svc', 'xray', 'trace segments', 'obs', 'Joins the same trace.'],
      ['cfn', 'trail', 'API calls recorded', 'obs', 'Every resource change is an API call.'],
      ['trail', 'logs', 'deliver log files', 'async', 'Every few minutes.'],
      ['cw', 'sns', 'alarm: errors > 1%', 'async', 'Fires after 5 bad minutes.'],
      ['sns', 'oncall', 'page + Slack', 'async', 'Someone is notified.']
    ],
    flow: [
      ['Deploy a change', 'Code review, then CloudFormation applies it; CloudTrail records every change.', 'dev>cfn, cfn>api, cfn>svc, cfn>db, cfn>trail, trail>logs', 'write'],
      ['Handle a request (traced)', 'One request crosses two services; X-Ray stitches the trace together.', 'api>svc, api>db, api>xray, svc>xray', 'read'],
      ['Errors spike: page on-call', 'Metrics cross the alarm threshold and SNS pages the on-call engineer.', 'api>cw, svc>cw, cw>sns, sns>oncall', 'background'],
      ['Audit who changed what', 'CloudTrail shows who did what; the logs live in S3 for years.', 'cfn>trail, trail>logs', 'background']
    ],
    why: [
      'Every resource comes from reviewed code, so environments match and changes are reversible.',
      'Alarms watch user-facing symptoms (error rate), not just CPU.',
      'Traces connect services, so the slow hop is visible without guessing.',
      'The audit trail is separate from app logs and kept in S3 for the long term.'
    ],
    tradeoffs: [
      'Logs and custom metrics can become a large share of the bill; set retention and sampling.',
      'Infrastructure as code slows down quick experiments a little, in exchange for safety.',
      'Too many noisy alarms train people to ignore pages; alarm on symptoms.'
    ],
    sources: [['Amazon CloudWatch', 'https://aws.amazon.com/cloudwatch/'], ['AWS CDK', 'https://aws.amazon.com/cdk/']]
  }
});

AWS_LESSONS.push({
  id: 'aws-analytics', group: 'core', title: 'Analytics: S3 data lake, Glue, Athena, Redshift',
  question: 'How do I analyze lots of data?',
  summary: 'Land everything in S3 (the data lake), clean and catalog it with Glue, ask one-off questions with Athena (pay per query), and serve busy dashboards from Redshift. Firehose streams data in without code. The production database never runs the heavy queries.',
  services: ['s3', 'kinesis', 'firehose', 'glue', 'athena', 'redshift', 'quick', 'opensearch'],
  decide: [
    ['Keep all raw data cheaply in open formats', ['s3'], 'The data lake: Parquet or Iceberg files, partitioned by date.'],
    ['Clean, transform, and catalog it', ['glue'], 'Serverless Spark ETL plus one shared table catalog. Amazon EMR for huge custom Spark or Flink clusters.'],
    ['Occasional SQL questions, paid per query', ['athena'], 'Serverless; about $5 per TB scanned.'],
    ['Fast dashboards for many people, complex joins', ['redshift'], 'A warehouse built for many concurrent BI queries.'],
    ['Stream events in with no code', ['firehose', 'kinesis'], 'Firehose to land data; Kinesis Data Streams when several real-time consumers need it.'],
    ['Search and explore logs interactively', ['opensearch'], 'Full-text log search with dashboards.']
  ],
  compare: {
    title: 'Side by side',
    cols: ['athena', 'redshift', 'glue', 'opensearch'],
    rows: [
      ['What it is', ['Serverless SQL over S3', 'Data warehouse', 'Serverless ETL + catalog', 'Search and log analytics']],
      ['Speed', ['Seconds per query', 'Sub-second to seconds', 'Minutes per job', 'Milliseconds for search']],
      ['You pay for', ['TB scanned (~$5/TB)', 'RPU-hours or node-hours', 'DPU-hours', 'Instances or OCUs + storage']],
      ['Best for', ['Ad-hoc questions, logs in S3', 'BI dashboards, heavy joins', 'Scheduled pipelines', 'Text search, log exploration']]
    ]
  },
  examples: [
    ['A PM asks a one-off question about last quarter’s sign-ups', ['athena'], 'Write SQL against the lake and pay a few cents.', 'Spinning up a warehouse for one question.'],
    ['200 sales reps open the same dashboard every morning', ['redshift', 'quick'], 'A warehouse handles many fast, concurrent queries; Quick Sight draws the dashboard.', 'Athena charges per scan and slows down under heavy concurrency.'],
    ['Raw JSON events must become clean, typed tables each night', ['glue'], 'A Spark job writes Parquet or Iceberg and updates the catalog.', 'Hand-written scripts on a cron server break silently.'],
    ['Stream IoT readings into the lake with zero code', ['firehose'], 'Buffers, converts to Parquet, writes to S3.', 'Writing and running your own consumers.']
  ],
  quiz: [
    ['You query 10 TB of raw JSON logs in Athena and the bill is high. Best fix?', ['A bigger Athena', 'Convert to partitioned Parquet', 'Move the logs to EBS', 'Use SNS'], 1, 'Columnar, partitioned files let Athena scan only the columns and dates you ask for.'],
    ['Which component tells Athena and Redshift what tables exist in S3?', ['CloudTrail', 'The Glue Data Catalog', 'Route 53', 'IAM'], 1, 'The Glue Data Catalog is the shared table directory.'],
    ['Dashboards for 500 concurrent users with sub-second response.', ['Athena', 'Redshift', 'DynamoDB Scan', 'S3 Select'], 1, 'Redshift is built for fast, concurrent BI queries.']
  ],
  map: {
    title: 'Clickstream data lake',
    subtitle: 'Stream in with Kinesis and Firehose · raw and curated zones in S3 · Glue ETL and catalog · Athena for questions, Redshift for dashboards',
    layers: ['Client', 'Ingest', 'Storage', 'Compute', 'Data', 'Analytics'],
    nodes: [
      ['app', 'users', 'Web + mobile apps', 'Client', 'Emit click and purchase events.'],
      ['analyst', 'users', 'Analysts', 'Client', 'Ask questions in SQL and read dashboards.'],
      ['kds', 'kinesis', 'Click stream', 'Ingest', 'An ordered stream; other consumers (fraud, live counters) can read it too.'],
      ['fh', 'firehose', 'Buffer → Parquet', 'Ingest', 'Batches records and writes compressed Parquet files to S3 about every minute.'],
      ['raw', 's3', 'Raw zone', 'Storage', 'Untouched data, partitioned by date. Cheap and replayable.', 'S3 raw'],
      ['etl', 'glue', 'Nightly ETL (Spark)', 'Compute', 'Cleans, de-duplicates, joins reference data, and writes curated tables.'],
      ['catalog', 'glue', 'Data Catalog', 'Compute', 'The list of tables, columns, and partitions every query engine reads.', 'Glue Catalog'],
      ['cur', 's3', 'Curated zone (Iceberg)', 'Data', 'Clean tables in an open format.', 'S3 curated'],
      ['athena', 'athena', 'Ad-hoc SQL', 'Analytics', 'Pay per TB scanned: ideal for occasional questions.'],
      ['rs', 'redshift', 'BI warehouse', 'Analytics', 'Fast dashboards for many users at once.'],
      ['qs', 'quick', 'Dashboards', 'Analytics', 'Quick Sight dashboards (formerly QuickSight) on top of Redshift.', 'Quick Sight', 'ANALYTICS']
    ],
    edges: [
      ['app', 'kds', 'PutRecords', 'async', 'Fire-and-forget from the app backend.'],
      ['kds', 'fh', 'read shard', 'async', 'Firehose is one consumer of the stream.'],
      ['fh', 'raw', 'Parquet files', 'async', 'Buffered, compressed, partitioned.'],
      ['raw', 'etl', 'nightly job', 'async', 'Glue reads yesterday’s partition.'],
      ['etl', 'cur', 'clean + dedupe', 'async', 'Writes curated tables.'],
      ['etl', 'catalog', 'update schema', 'sync', 'Registers new partitions.'],
      ['analyst', 'athena', 'SQL', 'sync', 'Ad-hoc questions.'],
      ['athena', 'catalog', 'table metadata', 'sync', 'Where the files are and which columns they have.'],
      ['athena', 'cur', 'scan Parquet', 'sync', 'Reads only the columns and partitions it needs.'],
      ['cur', 'rs', 'load / Spectrum', 'async', 'Hot tables are loaded for fast dashboards.'],
      ['analyst', 'qs', 'open dashboard', 'sync', 'The morning sales view.'],
      ['qs', 'rs', 'dashboard queries', 'sync', 'Sub-second for many viewers.']
    ],
    flow: [
      ['Collect events', 'Apps stream events and Firehose lands them in S3 as Parquet, with no code.', 'app>kds, kds>fh, fh>raw', 'write'],
      ['Nightly ETL', 'Glue cleans raw data into curated tables and updates the catalog.', 'raw>etl, etl>cur, etl>catalog', 'background'],
      ['Ask a one-off question', 'Athena reads the catalog and scans only what it needs from S3.', 'analyst>athena, athena>catalog, athena>cur', 'read'],
      ['Open the morning dashboard', 'Redshift serves fast queries to many viewers.', 'cur>rs, analyst>qs, qs>rs', 'read']
    ],
    why: [
      'S3 holds everything once, in open formats, so any engine can read it later.',
      'Raw and curated zones mean a bad ETL run can always be redone from the raw data.',
      'Occasional questions pay per query (Athena); constant dashboard traffic gets a warehouse (Redshift).'
    ],
    tradeoffs: [
      'Batch ETL means dashboards are hours behind; add stream processing if minutes matter.',
      'Athena is cheap for occasional use but can cost more than Redshift under constant heavy querying.',
      'Two copies (lake and warehouse) need to be kept consistent.'
    ],
    sources: [['Amazon Athena', 'https://aws.amazon.com/athena/'], ['AWS Glue', 'https://aws.amazon.com/glue/']]
  }
});
