import * as glue from "aws-cdk-lib/aws-glue";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as sfn from "aws-cdk-lib/aws-stepfunctions";
import * as rds from 'aws-cdk-lib/aws-rds';
import * as tasks from "aws-cdk-lib/aws-stepfunctions-tasks";
import { Construct,  } from 'constructs';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';


export interface dataPipelineProps {
    /** props needed to work **/
    assetsBucket: s3.Bucket,
    dbInstance: rds.DatabaseInstance,
    dataBucket: s3.Bucket;
  }

export class DataPipelineStack extends Construct {
  public readonly executeGlueJobsRole: iam.Role; 

  constructor(scope: Construct, id: string, props: dataPipelineProps) {
    super(scope, id);

    // Creamos un rol para asignarlo a los jobs
    this.executeGlueJobsRole = new iam.Role(this, "glue-job-role-id", {
        assumedBy: new iam.ServicePrincipal("glue.amazonaws.com"),
        roleName: "Glue-Jobs-Role",
        description: "Rol de IAM para que los Glue Jobs puedan leer y escribir en los buckets de S3 asi como guardar logs.",
    });

    // Añademos un Policy al rol de IAM
    this.executeGlueJobsRole.addToPolicy(
        new iam.PolicyStatement({
            resources: [props.assetsBucket.bucketArn + "/*",props.dataBucket.bucketArn + "/*"],
            actions: ["s3:*",
                    "s3-object-lambda:*"],
        })
    );

    // Cargamos una Managed Policy
    const managedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName(
        'CloudWatchFullAccess',
    );
    const managedPolicy_2 = iam.ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSGlueServiceRole', // from the arn after policy
    );
    const managedPolicy_3 = iam.ManagedPolicy.fromAwsManagedPolicyName(
      'SecretsManagerReadWrite', // from the arn after policy
    );
    // Asignamos la política al rol
    this.executeGlueJobsRole.addManagedPolicy(managedPolicy);
    this.executeGlueJobsRole.addManagedPolicy(managedPolicy_2);
    this.executeGlueJobsRole.addManagedPolicy(managedPolicy_3);

    // Job de validación
    const validationJob = new glue.CfnJob(this, 'validation-data-job-id', {
        command: {
          name: 'glueetl',
          pythonVersion: '3',
          scriptLocation: "s3://" + props.assetsBucket.bucketName + "/assets/pipeline_assets/validation-job.py",
        },
        defaultArguments: {
          "--SECRET_NAME": props.dbInstance.secret?.secretName,
        },
        role: this.executeGlueJobsRole.roleArn,
        description: 'Este job se encarga de validar que el archivo ingresado cumple con las reglas.',
        executionProperty: {
          maxConcurrentRuns: 3,
        },
        maxCapacity: 2,
        maxRetries: 0,
        name: 'validation-data-job',
        timeout: 5,
        glueVersion: "3.0",
      });

    // Job de validación
    const loadjob = new glue.CfnJob(this, 'load-data-job-id', {
        command: {
          name: 'glueetl',
          pythonVersion: '3',
          scriptLocation: "s3://" + props.assetsBucket.bucketName + "/assets/pipeline_assets/load-job.py",
        },
        defaultArguments: {
          "--SECRET_NAME": props.dbInstance.secret?.secretName,
        },
        role: this.executeGlueJobsRole.roleArn,
        description: 'Este job se encarga de cargar el archivo a la base de datos RDS.',
        executionProperty: {
          maxConcurrentRuns: 3,
        },
        maxCapacity: 2,
        maxRetries: 0,
        name: 'load-data-job',
        timeout: 5,
        glueVersion: "3.0",
      });

    // Step Function de orquestación
    const glue_1_task = new tasks.GlueStartJobRun(this, "sf-validation-data-job", {
        glueJobName: "validation-data-job",
        arguments: sfn.TaskInput.fromObject({
            "--KEY.$": '$.detail.object.key',
        }),
        outputPath: "$",
        inputPath: "$",
        resultPath: "$",
        integrationPattern: sfn.IntegrationPattern.RUN_JOB, //runJob.sync
          
      })

      const glue_2_task = new tasks.GlueStartJobRun(this, "sf-load-data-job", {
        glueJobName: "load-data-job",
        arguments: sfn.TaskInput.fromObject({
            "--KEY.$": "$.Arguments.--KEY",
        }),
        outputPath: "$",
        inputPath: "$",
        resultPath: "$",
        integrationPattern: sfn.IntegrationPattern.RUN_JOB, //runJob.sync
    })

    // const jobFailedTask = new sfn.Fail(this, 'notify-failure', {
    //     cause: 'AWS Glue Job Failed',
    //     error: 'Jobs returned FAILED', 
    //   });
    
    // Creamos un topico de SNS
    const topic = new sns.Topic(this, 'sns-topic', {
      displayName: 'Topico de notificacion de funcionalidad de ingesta de datos.',
    });

    // Añadimos los subscriptores
    topic.addSubscription(new subs.EmailSubscription("jurgen.guerra@unmsm.edu.pe"));

      
    const jobFailedTask = new tasks.SnsPublish(this, 'publish-notification', {
      topic: topic,
      message: sfn.TaskInput.fromJsonPathAt('$.error'),
      resultPath: '$.error',
      subject: "Failed Pipeline",
    });

    const stepFunctionDefinition = glue_1_task
    .addCatch(jobFailedTask,{   
        resultPath: '$.error',
    })
    .next(glue_2_task.addCatch(jobFailedTask,{   
        resultPath: '$.error',
    }))
       

    const SFMachine = new sfn.StateMachine(this, "state-machine-id", {
        stateMachineName: "data-ingestion-pipeline",
        definition: stepFunctionDefinition,
        timeout: Duration.minutes(10),
    });

    // Regla de eventbridge para ejecutar el SM
    const eventRule = new events.Rule(this, "s3-object-created", {
        ruleName: "s3-object-created",
        eventPattern: {
            source: ["aws.s3"],
            detailType: ["Object Created"],
            detail: {
                bucket: {
                    name: [props.dataBucket.bucketName]
                },
                object: {
                    key: [{
                        prefix: "ingestion"
                    }]
                }
            }
        }
    });

    // Creamos un rol para ejecutar el step function 
    const invokeStepFunctionRole = new iam.Role(this, "invoke-step-function-role-id", {
        assumedBy: new iam.ServicePrincipal("events.amazonaws.com"),
        roleName: "Invoke-Step-Function-Role",
        description: "Rol de IAM para invocar el Step Function.",
    });

    // Añademos un Policy al rol de IAM
    invokeStepFunctionRole.addToPolicy(
        new iam.PolicyStatement({
            resources: [SFMachine.stateMachineArn],
            actions: ["states:StartExecution"],
        })
    );

    // Añadimos un target a la regla del evento
    eventRule.addTarget(new targets.SfnStateMachine(SFMachine, {
        role: invokeStepFunctionRole
      }));
    

  }
}