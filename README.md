# auth-service
Authentication and authorisation service to work with all current and future PAF IT services on Kubernetes. 

## Requirements
- Kubernetes API Gateway (using Envoy)
- MySQL service running in the cluster

## Setup
Before deploying auth-service, execute the following in MySQL:

```SQL
CREATE DATABASE IF NOT EXISTS `auth-service`;
CREATE USER `auth-service`@`%` IDENTIFIED BY "***";
GRANT ALL on `auth-service`.* TO `auth-service`@`%`;
GRANT SELECT on `paf-admin`.`members` TO `auth-service`@`%`;
FLUSH PRIVILEGES;
```
Then deploy auth-service via GitHub action workflow.

## Adding clients

```bash
kubectl exec deploy/auth-service -- sh -c \
    'pnpm run client upsert --id <CLIENT_ID> --secret "<CLIENT_SECRET>" --name <CLIENT_NAME> \
       --redirect <CALLBACK_URL> --grant custom:magic_link'