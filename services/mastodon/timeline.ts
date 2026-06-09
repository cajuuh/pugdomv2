import apiClient from "../api/client";

export async function fetchHomeTimeline(maxId?: string) {
    const response = await apiClient.get('/timelines/home', {
        params: { max_id: maxId },
    });
    return response.data;
}