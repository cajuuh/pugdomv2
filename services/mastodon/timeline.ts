import apiClient from "../api/client";

export async function fetchHomeTimeline(maxId?: string) {
    const response = await apiClient.get('/timelines/home', {
        params: { max_id: maxId },
    });
    return response.data;
}

export async function fetchPublicTimeline(maxId?: string, local?: boolean) {
    const response = await apiClient.get('/timelines/public', {
        params: { max_id: maxId, local: local ? true : undefined },
    });
    return response.data;
}