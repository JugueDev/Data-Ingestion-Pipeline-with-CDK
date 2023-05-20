#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CdkcodeStack } from '../lib/cdkcode-stack';

const app = new cdk.App();
new CdkcodeStack(app, 'CdkcodeStack');
