import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { IngestStack } from './ingestion-stack';
import { Construct } from 'constructs';

export class CdkcodeStack extends Stack {

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const IngestionStack = new IngestStack(this, 'ingestionStack', {
      bucketname: 'ingestion-bucket-data-jg', 
    });

    

  }
}