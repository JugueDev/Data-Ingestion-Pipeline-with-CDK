import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext, SparkConf
from awsglue.context import GlueContext
from awsglue.job import Job
import time
from pyspark.sql.types import StructType, StructField, IntegerType, StringType
from awsglue.dynamicframe import DynamicFrame
import boto3
import json 
import base64

def get_secret(secret_name):
    '''
    Función que retorna el secret que contienen las credenciales asociadas
    al secret_name.
    
    - Entradas:
        secret_name: string 
        
    - Salidas: 
        secret: string

    '''
    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(service_name='secretsmanager',region_name="us-east-1")
    get_secret_value_response = client.get_secret_value(SecretId=secret_name)
    
    # Depending on whether the secret is a string or binary, one of these fields will be populated.
    if 'SecretString' in get_secret_value_response:
        secret = json.loads(get_secret_value_response['SecretString'])
    else:
        secret = json.loads(base64.b64decode(
            get_secret_value_response['SecretBinary']))
    return secret


args = getResolvedOptions(sys.argv, ['table','SECRET_NAME'])
file = args['table']
print(f"Tabla a restaurar: {file}")


# Config rds
secret_name = args['SECRET_NAME']
rds_creds = get_secret(secret_name)

# from secret
rds_host = rds_creds['host']
rds_passwd = rds_creds['password']
rds_port = rds_creds['port']
rds_user = rds_creds['username']
print("Credenciales obtenidas")



sc = SparkContext.getOrCreate()
glueContext = GlueContext(sc)
spark = glueContext.spark_session # Importante

dynamicFrame = glueContext.create_dynamic_frame.from_options(
    connection_type="s3",
    connection_options={"paths": ["s3://ingestion-bucket-data-test-jg/backup/"+file],
                        },
    format="avro"
)

dynamicFrame.printSchema()

connection_s = {
    "url": "jdbc:mysql://" + rds_host + ":" + str(rds_port) + "/appdb",
    "user": rds_user,
    "password": rds_passwd,
    "customJdbcDriverS3Path": "s3://assets-bucket-for-test-jg/assets/mysql-connector-java-8.0.28.jar",
    "customJdbcDriverClassName": "com.mysql.cj.jdbc.Driver"}

connection_s["dbtable"] = file


try:
    glueContext.write_from_options(frame_or_dfc=dynamicFrame, connection_type="mysql", connection_options=connection_s)
except Exception as e:
    print(f"Al insertar datos en {file} se detecto que existían registros duplicados: {str(e)}")

      