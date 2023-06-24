import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { IngestStack } from './ingestion-stack';
import { Construct } from 'constructs';
import { BootstrapStack } from './bootstrap-stack';
import { DatabaseStack } from './database-stack';

export class CdkcodeStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bootstrapStack = new BootstrapStack(this, 'bootstrapStack');


    const IngestionStack = new IngestStack(this, 'ingestionStack', {
      bucketname: 'ingestion-bucket-data-jg', 
      assetsBucket: bootstrapStack.assetsBucket
    });
    
    const databaseStack = new DatabaseStack(this, 'databaseStack', {
      dbVpc: bootstrapStack.vpc,
      publicSN: bootstrapStack.publicSubnet,
      publicSN2: bootstrapStack.publicSubnet2,
    });
    

  }
}