import { handleEquitySeoRequest } from '../../_lib/handleEquitySeo.js';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request, context: { params?: { symbol?: string } }) {
  return handleEquitySeoRequest(request, context, 'stock');
}
