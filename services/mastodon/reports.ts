import apiClient from '../api/client';
import { Rule } from './types';

export type ReportCategory = 'spam' | 'legal' | 'violation' | 'other';

export interface ReportParams {
    account_id: string;
    status_ids?: string[];
    comment?: string;
    // For accounts on other servers: also send the report to their moderators
    forward?: boolean;
    category: ReportCategory;
    // Which server rules were broken; required for `violation`
    rule_ids?: string[];
}

// The longest comment Mastodon takes by default
export const REPORT_COMMENT_LIMIT = 1000;

// The server's rules, to say which one a post breaks
export async function getRules(): Promise<Rule[]> {
    const response = await apiClient.get<Rule[]>('/instance/rules');
    return response.data;
}

// Sends a report to the server's moderators
export async function createReport(params: ReportParams): Promise<void> {
    await apiClient.post('/reports', params);
}
