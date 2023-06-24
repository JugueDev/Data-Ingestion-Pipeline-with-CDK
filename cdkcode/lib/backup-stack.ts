

import * as glue from "aws-cdk-lib/aws-glue";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct,  } from 'constructs';
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from 'aws-cdk-lib/aws-rds';
import * as api_gw from "aws-cdk-lib/aws-apigateway";
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export interface backupProps {
    /** props needed to work **/
    executeGlueJobsRole: iam.Role,
    assetsBucket: s3.Bucket,
    dbInstance: rds.DatabaseInstance,
    apiGateway: api_gw.RestApi,
  }

export class BackupStack extends Construct {

  constructor(scope: Construct, id: string, props: backupProps) {
    super(scope, id);

        // Job de Backup
        const backupJob = new glue.CfnJob(this, 'backup-job-id', {
            command: {
              name: 'glueetl',
              pythonVersion: '3',
              scriptLocation: "s3://" + props.assetsBucket.bucketName + "/assets/pipeline_assets/backup-job.py",
            },
            defaultArguments: {
              "--SECRET_NAME": props.dbInstance.secret?.secretName,
            },
            role: props.executeGlueJobsRole.roleArn,
            description: 'Este job se encarga de generar backups.',
            executionProperty: {
              maxConcurrentRuns: 3,
            },
            maxCapacity: 2,
            maxRetries: 0,
            name: 'backup-job',
            timeout: 5,
            glueVersion: "3.0",
          });

        // Job de Restore
        const restoreJob = new glue.CfnJob(this, 'restore-job-id', {
          command: {
            name: 'glueetl',
            pythonVersion: '3',
            scriptLocation: "s3://" + props.assetsBucket.bucketName + "/assets/pipeline_assets/restore-job.py",
          },
          defaultArguments: {
            "--SECRET_NAME": props.dbInstance.secret?.secretName,
          },
          role: props.executeGlueJobsRole.roleArn,
          description: 'Este job se encarga de hacer restore.',
          executionProperty: {
            maxConcurrentRuns: 3,
          },
          maxCapacity: 2,
          maxRetries: 0,
          name: 'restore-job',
          timeout: 5,
          glueVersion: "3.0",
        });

    // Creamos un rol para asignarlo a la función lambda
    const lambdaApiRole = new iam.Role(this, "lambda-invoke-role-id", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      roleName: "Lambda-Role",
      description: "Rol de IAM para que las funciones lambda puedan ejecutarse y ejecutar jobs de glue.",
    });

    const lambdaManagedPolicy = iam.ManagedPolicy.fromAwsManagedPolicyName(
      'service-role/AWSLambdaBasicExecutionRole', // from the arn after policy
    );
    // Asignamos la política al rol
    lambdaApiRole.addManagedPolicy(lambdaManagedPolicy);
      
    // Añademos un Policy al rol de IAM
    lambdaApiRole.addToPolicy(
      new iam.PolicyStatement({
          resources: ["arn:aws:glue:us-east-1:539548017896:job/*"],
          actions: ["glue:BatchStopJobRun",
                    "glue:GetJobRun",
                    "glue:GetJobRuns",
                    "glue:StartJobRun"],
      })
    );

    // Se define una función Lambda 
    const backupLambda = new lambda.Function(this, 'backup-api-lambda', {
      runtime: lambda.Runtime.PYTHON_3_9,
      handler: 'function.handler',
      functionName: "backup-api-lambda",
      code: lambda.Code.fromAsset(path.join(__dirname, "/../../assets/backup_assets")), // frombucket requires zip file
      role: lambdaApiRole,
    });
    

     // Añadir una integración para el API Gateway con Lambda
     const lambdaIntegration = new api_gw.LambdaIntegration(backupLambda, {
        proxy: true,
        integrationResponses: [
          {
            statusCode: "200",
          },
        ],
    });

    // Añadir el recurso backup para ejecutar el lambda
    props.apiGateway.root
    .addResource('backup')
    .addMethod(
      'GET',
      lambdaIntegration,
      {
      methodResponses: [
        {
          statusCode: "200",
        },
      ],
    }
    );

    // Añadir el recurso backup para ejecutar el lambda
    props.apiGateway.root
    .addResource('restore')
    .addResource("{table}")
    .addMethod(
      'GET',
      lambdaIntegration,
      {
      methodResponses: [
        {
          statusCode: "200",
        },
      ],
    }
    );
  }
}