import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct,  } from 'constructs';


export interface IngestProps {
    /** props needed to work **/
    bucketname: string,
  }

export class IngestStack extends Construct {

  constructor(scope: Construct, id: string, props: IngestProps) {
    super(scope, id);

    // Bucket donde se almacenarán los archivos 
    const dataBucket = new s3.Bucket(this, "ingestion-bucket-id", {
        bucketName: props.bucketname,
        eventBridgeEnabled: true,
    });


  }
}

