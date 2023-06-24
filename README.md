# Data-Ingestion-Pipeline-with-CDK
Repositorio donde se almacenan los archivos y esquemas correspondientes a un sistema de ingesta de datos con API Gateway, CDK y S3 

Para poder agilizar el proceso de desarrollo de este proyecto, así como mantener una consistencia en el despliegue y mejorar la seguridad se utilizará IaC a través del Cloud Development Kit(CDK) provisto por AWS. Específicamente se usará Typescript para el despliegue de la infraestructura y Python para el manejo de los datos.

Para poder levantar la infraestructura, después de descargar el repositorio ejecutar los siguientes comandos en la carpeta cdkcode para descargar las dependencias:
```
npm install
npm i constructs
```


## Pipeline de datos
Se diseñará un pipeline de datos ETL. Este pipeline estará compuesto de 3 capas, una capa de ingesta, una de transformación y una de carga o despliegue.

Para la capa de ingesta se utilizarán los servicios de AWS API Gateway, roles IAM y un bucket de S3 donde se almacenará el archivo cargado conforme al diagrama de arquitectura de referencia adjunto:

![Diagrama de ingesta](https://github.com/JugueDev/Data-Ingestion-Pipeline-with-CDK/blob/main/images/diagrama_ingesta.jpg?raw=true)

Para probar la funcionalidad con curl:

```
# Para la ingesta de archivos
curl -i  -H "x-api-key: {api-key}" -X PUT 'https://{api_id}.execute-api.{region}.amazonaws.com/prod/upload/file.csv' --data-binary '@file.csv'

```

Posteriormente este archivo csv pasará por un pipeline de datos compuesto por tres zonas/capas:

![Diagrama del Pipeline de datos](https://github.com/JugueDev/Data-Ingestion-Pipeline-with-CDK/blob/main/images/diagrama_pipeline.jpg?raw=true)

Estas capas van a estar coordinadas por un Step Function el cual además se encargará de notificar en caso exista un error. Este Step Function se disparará gracias a una regla de Eventbridge que se activa al momento de cargar un archivo en el bucket de S3 de datos.

![Diagrama del Flujo del Pipeline de datos](https://github.com/JugueDev/Data-Ingestion-Pipeline-with-CDK/blob/main/images/diagrama_pipeline_flujo.jpg?raw=true)


En la capa de validación pasará por un job (AWS Glue) que se encargará de ejecutar las siguientes validaciones:
- Validación de la integridad y del tipo de archivo.
- Validación de las reglas de diccionario.

Finalmente una vez validado el archivo se escribirá en una base de datos RDS.


