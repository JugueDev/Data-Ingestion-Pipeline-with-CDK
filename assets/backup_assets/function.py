import boto3
import json

# create the glue resource
client = boto3.client('glue')


def handler(event, context):
    '''Provide an event that contains the following keys:

      - operation: -
    '''
    print(event)
    task_type = event["path"].split("/")[1]
    print(task_type)
    if task_type == "restore":
        body = "Restore process iniciated."
        table = event["path"].split("/")[2]
    else:
        table = ""
        body = "Backup process iniciated."
    tables_list = []

    if table in tables_list:
        # Job a ejecutar: 
        glueJobName = task_type + "-job"

        response = client.start_job_run(
            JobName = glueJobName,
            Arguments={
                '--table': table
            })
        print('El siguiente job se inició: ' + glueJobName)
        print('job id: ' + response['JobRunId'])
    else:
        body = "La tabla no se encuentra en la lista o el formato no es el adecuado."
    
    response = {
    "statusCode": "200",
    "headers": { "table": table},
    "body": body
    }   
    return response