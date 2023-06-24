import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as glue from 'aws-cdk-lib/aws-glue';
import * as cdk from 'aws-cdk-lib';
import { Construct,  } from 'constructs';

export interface DatabaseStackProps {
    /** props needed to work **/
    dbVpc: ec2.Vpc,
    publicSN: ec2.PublicSubnet,
    publicSN2: ec2.PublicSubnet,
  }

export class DatabaseStack extends Construct {
   public readonly dbInstance: rds.DatabaseInstance; 

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id);


    // Creamos un grupo de seguridad para la base de datos
    const appSG = new ec2.SecurityGroup(this, 'application-sg', {
        vpc: props.dbVpc,
        securityGroupName: "application-sg",
    });

    appSG.addIngressRule(
      ec2.Peer.ipv4("190.236.239.32/32"),
      ec2.Port.tcp(3306),
      'allow MySQL connections from my own IP',
    );
    appSG.addIngressRule(
        appSG,
        ec2.Port.allTraffic(),
        'allow connections from other members of the SG.',
      );
      appSG.addIngressRule(
        ec2.Peer.ipv4("52.23.63.224/27"),
        ec2.Port.tcp(3306),
        'Amazon-QuickSight-accesss',
      );

    // Crear la base de datos RDS
    this.dbInstance = new rds.DatabaseInstance(this, 'db-instance', {
        vpc: props.dbVpc,
        securityGroups: [appSG],
        vpcSubnets: {
            subnets: [props.publicSN, props.publicSN2],
        },
        engine: rds.DatabaseInstanceEngine.mysql({
            version: rds.MysqlEngineVersion.VER_8_0_28,
        }),
        instanceType: ec2.InstanceType.of(
            ec2.InstanceClass.BURSTABLE3,
            ec2.InstanceSize.MICRO,
        ),
        credentials: rds.Credentials.fromGeneratedSecret('mysj10qqw'),
        multiAz: false,
        allocatedStorage: 10,
        maxAllocatedStorage: 12,
        allowMajorVersionUpgrade: false,
        autoMinorVersionUpgrade: true,
        backupRetention: cdk.Duration.days(0),
        deleteAutomatedBackups: true,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        deletionProtection: false,
        databaseName: 'appdb',
        publiclyAccessible: true,
    });

    new cdk.CfnOutput(this, 'dbEndpoint', {
    value: this.dbInstance.instanceEndpoint.hostname,
    });

    new cdk.CfnOutput(this, 'secretName', {
    value: this.dbInstance.secret?.secretName!,
    });
    
    const glueEndpoint = props.dbVpc.addInterfaceEndpoint('glue-endpoint',
    {
        service: ec2.InterfaceVpcEndpointAwsService.GLUE,
        subnets: {
            subnets: [props.publicSN, props.publicSN2],
        },
        securityGroups: [appSG],
        privateDnsEnabled: true,

    });

    const secretsEndpoint = props.dbVpc.addInterfaceEndpoint('secrets-endpoint',
    {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        subnets: {
            subnets: [props.publicSN, props.publicSN2]
        },
        securityGroups: [appSG],
        privateDnsEnabled: true,
    
    }
    )

}
}