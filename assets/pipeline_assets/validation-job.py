
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.dynamicframe import DynamicFrame
from awsglue.utils import getResolvedOptions
from pyspark.sql.functions import col
import sys

def only_numeric(df_test, column_name):
    '''
    Función que se encarga de validar si los valores de una columna en un dataframe
    son solo numéricos.
    
    - Entradas:
        df_test: pyspark.dataframe
        column_name: string 
        
    - Salidas: Sin salidas.

    '''
    not_numeric_values = df_test.count() - df_test.filter(col(column_name).cast("int").isNotNull()).count()
    print(f'Cantidad de valores no numéricos: {not_numeric_values} en la columna: {column_name}')
    if not_numeric_values != 0:
        raise ValueError('l archivo tiene valores no numéricos o nulos.')

def only_not_null(df_test, column_name):
    '''
    Función que se encarga de retirar los registros que tienen valores nulos en una columna numérica.
    
    - Entradas:
        df_test: pyspark.dataframe
        column_name: string 
        
    - Salidas: pyspark.dataframe.

    '''
    df_fitered = df_test.filter(col(column_name).isNotNull())
    df_fitered = df_test.filter(col(column_name).cast("int").isNotNull())
    return df_fitered

sc = SparkContext.getOrCreate()
glueContext = GlueContext(sc)
spark = glueContext.spark_session

args = getResolvedOptions(sys.argv, ['KEY'])
key_value = args['KEY']
file = key_value.split('/')[-1].split('.')[0]
print(file)
path_input = "s3://ingestion-bucket-data-test-jg/ingestion/" + file + ".csv"

if key_value[-3:] != "csv":
    raise ValueError('El archivo no tiene formato csv.')

tables_list = [""]

if file not in tables_list:
    raise ValueError('El archivo no pertenece a una  tabla o no tiene el formato establecido.')


if file == "nombre de alguna tabla":
    print("To Do: validaciones")
    df = spark.read\
        .format("csv")\
        .option("header", "false")\
        .option("delimiter",";")\
        .load(path_input)
    df = df.toDF(*("id", "name", "datetime", "department_id", "job_id" ))
    df = only_not_null(df, "department_id")
    df = only_not_null(df, "id")
    df = only_not_null(df, "job_id")
    df = df.filter(col("name").isNotNull())
    df = df.filter(col("datetime").isNotNull())
    only_numeric(df, "department_id")
    only_numeric(df, "id")
    only_numeric(df, "job_id")

if df.count() == 0:
    raise ValueError('El archivo cargado no tiene valores.')
  

df.printSchema()

path_output = "s3://ingestion-bucket-data-test-jg/validation/" + file 
df.write.mode("overwrite")\
    .option("header", "true")\
    .parquet(path_output)
