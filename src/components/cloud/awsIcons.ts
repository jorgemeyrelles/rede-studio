import ec2Icon from '../../assets/aws-icons/Arch_Amazon-EC2_48.svg';
import asgIcon from '../../assets/aws-icons/Arch_Amazon-EC2-Auto-Scaling_48.svg';
import rdsIcon from '../../assets/aws-icons/Arch_Amazon-RDS_48.svg';
import s3Icon from '../../assets/aws-icons/Arch_Amazon-Simple-Storage-Service_48.svg';
import accountIcon from '../../assets/aws-icons/AWS-Account_32.svg';
import albIcon from '../../assets/aws-icons/Res_Elastic-Load-Balancing_Application-Load-Balancer_48.svg';
import nlbIcon from '../../assets/aws-icons/Res_Elastic-Load-Balancing_Network-Load-Balancer_48.svg';
import privateSubnetIcon from '../../assets/aws-icons/Private-subnet_32.svg';
import publicSubnetIcon from '../../assets/aws-icons/Public-subnet_32.svg';
import regionIcon from '../../assets/aws-icons/Region_32.svg';
import natGatewayIcon from '../../assets/aws-icons/Res_Amazon-VPC_NAT-Gateway_48.svg';
import naclIcon from '../../assets/aws-icons/Res_Amazon-VPC_Network-Access-Control-List_48.svg';
import endpointsIcon from '../../assets/aws-icons/Res_Amazon-VPC_Endpoints_48.svg';
import internetGatewayIcon from '../../assets/aws-icons/Res_Amazon-VPC_Internet-Gateway_48.svg';
import vpcIcon from '../../assets/aws-icons/Virtual-private-cloud-VPC_32.svg';
import cloudIcon from '../../assets/aws-icons/AWS-Cloud_32.svg';
import cloudFrontIcon from '../../assets/aws-icons/Arch_Amazon-CloudFront_48.svg';
import acmIcon from '../../assets/aws-icons/Arch_AWS-Certificate-Manager_48.svg';
import wafIcon from '../../assets/aws-icons/Arch_AWS-WAF_48.svg';
import hostedZoneIcon from '../../assets/aws-icons/Res_Amazon-Route-53-Hosted-Zone_48.svg';
import usersIcon from '../../assets/aws-icons/Res_Users_48_Dark.svg';
import kmsIcon from '../../assets/aws-icons/Arch_AWS-Key-Management-Service_48.svg';
import secretsIcon from '../../assets/aws-icons/Arch_AWS-Secrets-Manager_48.svg';
import parameterIcon from '../../assets/aws-icons/Res_AWS-Systems-Manager_Parameter-Store_48.svg';
import cognitoIcon from '../../assets/aws-icons/Arch_Amazon-Cognito_48.svg';
import lambdaIcon from '../../assets/aws-icons/Arch_AWS-Lambda_48.svg';
import apiGatewayIcon from '../../assets/aws-icons/Arch_Amazon-API-Gateway_48.svg';
import ecrIcon from '../../assets/aws-icons/Arch_Amazon-Elastic-Container-Registry_48.svg';
import ecsIcon from '../../assets/aws-icons/Arch_Amazon-Elastic-Container-Service_48.svg';
import fargateIcon from '../../assets/aws-icons/Arch_AWS-Fargate_48.svg';
import eksIcon from '../../assets/aws-icons/Arch_Amazon-Elastic-Kubernetes-Service_48.svg';
import auroraIcon from '../../assets/aws-icons/Arch_Amazon-Aurora_48.svg';
import elastiCacheIcon from '../../assets/aws-icons/Arch_Amazon-ElastiCache_48.svg';
import dynamoDbIcon from '../../assets/aws-icons/Arch_Amazon-DynamoDB_48.svg';
import sqsIcon from '../../assets/aws-icons/Arch_Amazon-Simple-Queue-Service_48.svg';
import snsIcon from '../../assets/aws-icons/Arch_Amazon-Simple-Notification-Service_48.svg';
import efsIcon from '../../assets/aws-icons/Arch_Amazon-EFS_48.svg';
import logsIcon from '../../assets/aws-icons/Res_Amazon-CloudWatch_Logs_48.svg';
import cloudTrailIcon from '../../assets/aws-icons/Arch_AWS-CloudTrail_48.svg';
import backupIcon from '../../assets/aws-icons/Arch_AWS-Backup_48.svg';

/**
 * Ícone oficial AWS (src/assets/aws-icons, sem alteração — ver NOTICE.md)
 * por tipo do catálogo do Studio Cloud. A AZ não tem ícone no pacote
 * oficial: nos diagramas da AWS ela é só a borda tracejada com o nome. O
 * pacote também não traz ícone de security group.
 */
const ICONS: Record<string, string> = {
  'aws.account': accountIcon,
  'aws.region': regionIcon,
  'aws.vpc': vpcIcon,
  'aws.igw': internetGatewayIcon,
  'aws.vpc_endpoint.gateway': endpointsIcon,
  'aws.subnet.public': publicSubnetIcon,
  'aws.subnet.private': privateSubnetIcon,
  'aws.nat': natGatewayIcon,
  'aws.nacl': naclIcon,
  'aws.ec2': ec2Icon,
  'aws.asg': asgIcon,
  'aws.alb': albIcon,
  'aws.nlb': nlbIcon,
  'aws.rds': rdsIcon,
  'aws.s3': s3Icon,
  'aws.global': cloudIcon,
  'ext.internet': usersIcon,
  'aws.route53.zone': hostedZoneIcon,
  'aws.acm.certificate': acmIcon,
  'aws.cloudfront': cloudFrontIcon,
  'aws.waf.acl': wafIcon,
  'aws.vpc_endpoint.interface': endpointsIcon,
  'aws.kms.key': kmsIcon,
  'aws.secret': secretsIcon,
  'aws.ssm.parameter': parameterIcon,
  'aws.cognito.userpool': cognitoIcon,
  'aws.lambda': lambdaIcon,
  'aws.apigw.http': apiGatewayIcon,
  'aws.ecr.repository': ecrIcon,
  'aws.ecs.cluster': ecsIcon,
  'aws.ecs.service': fargateIcon,
  'aws.eks.cluster': eksIcon,
  'aws.eks.nodegroup': asgIcon,
  'aws.aurora': auroraIcon,
  'aws.elasticache': elastiCacheIcon,
  'aws.dynamodb.table': dynamoDbIcon,
  'aws.sqs.queue': sqsIcon,
  'aws.sns.topic': snsIcon,
  'aws.efs': efsIcon,
  'aws.logs.group': logsIcon,
  'aws.cloudtrail': cloudTrailIcon,
  'aws.backup.plan': backupIcon,
};

export function getCloudIcon(type: string): string | undefined {
  return ICONS[type];
}
