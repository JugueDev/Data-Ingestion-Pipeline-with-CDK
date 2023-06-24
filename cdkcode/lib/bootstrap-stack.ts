/* En este stack se crearán todos los recursos compartidos para el resto de stacks */

import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct,  } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';


export class BootstrapStack extends Construct {
  public readonly assetsBucket: s3.Bucket; 
  public readonly vpc: ec2.Vpc; 
  public readonly publicSubnet: ec2.PublicSubnet; 
  public readonly publicSubnet2: ec2.PublicSubnet; 

  constructor(scope: Construct, id: string) {
    super(scope, id);
    
    // Bucket donde se almacenarán los archivos 
    this.assetsBucket = new s3.Bucket(this, "assets-bucket-id", {
        bucketName: "assets-bucket-for-test-jg",
    });
  
    // Se copian los scripts y demas assets a este bucket
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
        sources: [s3deploy.Source.asset('../assets')],
        destinationBucket: this.assetsBucket,
        destinationKeyPrefix: 'assets', 
      });

    // Creamos una VPC
    this.vpc = new ec2.Vpc(this, 'my-cdk-vpc', {
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 0,
      vpcName: "vpc-app",
      maxAzs: 1,
      subnetConfiguration:[],
      
      
    });
    
    // Creamos una public subnet
    this.publicSubnet = new ec2.PublicSubnet(this, 'MyPublicSubnet', {
      availabilityZone: 'us-east-1b',
      cidrBlock: '10.0.0.0/24',
      vpcId: this.vpc.vpcId,
    });

    // Creamos un internet gateway
    const ig = new ec2.CfnInternetGateway(this, 'my-ig');

    // Adjuntamos el IG a la VPC
    const InternetGatewayAttachment = new ec2.CfnVPCGatewayAttachment(this, 'internet-gateway-attatchment', {
      vpcId: this.vpc.vpcId,
      internetGatewayId: ig.attrInternetGatewayId,
    });


    //Añadimos una ruta al route table
    this.publicSubnet.addRoute("static-route", {
      routerId: ig.attrInternetGatewayId,
      routerType: ec2.RouterType.GATEWAY,
      destinationCidrBlock: "0.0.0.0/0",
      enablesInternetConnectivity: true
    })

    // Creamos una segunda public subnet
    this.publicSubnet2 = new ec2.PublicSubnet(this, 'MyPublicSubnet-2', {
      availabilityZone: 'us-east-1a',
      cidrBlock: '10.0.1.0/24',
      vpcId: this.vpc.vpcId,
    });

    //Añadimos una ruta al route table
    this.publicSubnet2.addRoute("static-route", {
      routerId: ig.attrInternetGatewayId,
      routerType: ec2.RouterType.GATEWAY,
      destinationCidrBlock: "0.0.0.0/0",
      enablesInternetConnectivity: true
    })
    
  }
}
