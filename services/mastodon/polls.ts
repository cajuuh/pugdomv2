import apiClient from '../api/client';
import { Poll } from './types';

export interface VoteParams {
    choices: number[];
}

export async function votePoll(id: string, params: VoteParams): Promise<Poll> {
    const response = await apiClient.post(`/polls/${id}/votes`, params);
    return response.data;
}
