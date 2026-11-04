/**
 * ==============================================================================
 * AETHER — LAMBDA DE SINCRONIZACIÓN DE BÓVEDA (AWS SPAIN eu-south-2)
 * ==============================================================================
 * Maneja el catálogo en DynamoDB y genera Presigned URLs para S3.
 * Autenticación: Valida el JWT de Cognito a través de API Gateway HTTP API v2.
 * SDK: AWS SDK v3 nativo de Node.js 20 (cero dependencias externas).
 * ==============================================================================
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
const s3 = new S3Client({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.CATALOG_TABLE_NAME;
const BUCKET_NAME = process.env.VAULT_BUCKET_NAME;

export async function handler(event) {
  const origin = event.headers?.origin || '*';
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,x-amz-date',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };

  // Manejo de preflight CORS
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // 1. Extraer identificador único de autor (sub) verificado por el JWT Authorizer
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const userId = claims?.sub;

  if (!userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'No autorizado: token JWT ausente o inválido' })
    };
  }

  const method = event.requestContext?.http?.method;
  const rawPath = event.rawPath || event.requestContext?.http?.path;

  try {
    // ------------------------------------------------------------------------
    // 1. GET /vault/works -> Lista todas las obras del autor
    // ------------------------------------------------------------------------
    if (method === 'GET' && rawPath === '/vault/works') {
      const result = await ddb.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId }
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ works: result.Items || [] })
      };
    }

    // ------------------------------------------------------------------------
    // 2. POST /vault/sync/init -> Registra metadatos y entrega Presigned PUT URL
    // ------------------------------------------------------------------------
    if (method === 'POST' && rawPath === '/vault/sync/init') {
      const body = JSON.parse(event.body || '{}');
      const { workId, title, updatedAt, wordCount, activePhase, sizeBytes, checksum } = body;

      if (!workId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'workId es requerido para sincronizar' })
        };
      }

      const s3Key = `authors/${userId}/${workId}/archive.aether`;

      // Guardar o actualizar metadatos atómicos en DynamoDB
      const item = {
        userId,
        workId,
        title: title || 'Sin título',
        updatedAt: updatedAt || Date.now(),
        wordCount: wordCount || 0,
        activePhase: activePhase || 'crystal',
        sizeBytes: sizeBytes || 0,
        checksum: checksum || '',
        s3Key,
        syncedAt: Date.now()
      };

      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      }));

      // Generar URL firmada de S3 para subida directa (15 minutos de validez)
      const putCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ContentType: 'application/json'
      });

      const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: 900 });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          workId,
          uploadUrl,
          s3Key,
          expiresInSeconds: 900
        })
      };
    }

    // ------------------------------------------------------------------------
    // 3. GET /vault/works/{workId}/download -> Entrega Presigned GET URL
    // ------------------------------------------------------------------------
    const downloadMatch = rawPath.match(/^\/vault\/works\/([^\/]+)\/download$/);
    if (method === 'GET' && downloadMatch) {
      const workId = decodeURIComponent(downloadMatch[1]);
      const s3Key = `authors/${userId}/${workId}/archive.aether`;

      const meta = await ddb.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { userId, workId }
      }));

      const getCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
      });

      const downloadUrl = await getSignedUrl(s3, getCommand, { expiresIn: 900 });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          workId,
          downloadUrl,
          metadata: meta.Item || null,
          expiresInSeconds: 900
        })
      };
    }

    // ------------------------------------------------------------------------
    // 4. DELETE /vault/works/{workId} -> Elimina de DynamoDB y S3
    // ------------------------------------------------------------------------
    const deleteMatch = rawPath.match(/^\/vault\/works\/([^\/]+)$/);
    if (method === 'DELETE' && deleteMatch) {
      const workId = decodeURIComponent(deleteMatch[1]);
      const s3Key = `authors/${userId}/${workId}/archive.aether`;

      await Promise.all([
        ddb.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { userId, workId }
        })),
        s3.send(new DeleteObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key
        }))
      ]);

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, workId })
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: `Ruta no encontrada: ${method} ${rawPath}` })
    };
  } catch (error) {
    console.error('[SyncVaultLambda] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message || 'Error interno del servidor en sincronización' })
    };
  }
}
