import axios from "axios";
import { beginApiRequest, endApiRequest } from "../utils/apiLoadingStore";
import { notifyApiError } from "../utils/apiErrorStore";
import { API_ENDPOINTS } from "./endpoints";
import {
    isSessionInvalidated,
    triggerSessionExpiry,
} from "../utils/sessionExpiryStore";

function isAuthenticationRequest(config) {
    const url = config.url || "";
    return url.includes(API_ENDPOINTS.userLogin) ||
        url.includes(API_ENDPOINTS.forgotPassword);
}

function endTrackedRequest(config) {
    if (config?.__apiLoadingTracked) {
        config.__apiLoadingTracked = false;
        endApiRequest();
    }
}

export const axiosInstance = axios.create({
    baseURL: "http://localhost:5050",
    timeout: 30000,
    withCredentials: true,
});

axiosInstance.interceptors.request.use(
    (config) => {
        config.__skipGlobalFeedback = isAuthenticationRequest(config);
        if (isSessionInvalidated() && !config.__skipGlobalFeedback) {
            config.__skipGlobalFeedback = true;
            const error = new Error("Your session has expired. Please log in again.");
            error.config = config;
            return Promise.reject(error);
        }
        delete config.headers.Authorization;
        if (!config.__skipGlobalFeedback) {
            config.__apiLoadingTracked = true;
            beginApiRequest();
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Handle unauthorized/expired token responses - show global dialog and clear auth
axiosInstance.interceptors.response.use(
    (response) => {
        endTrackedRequest(response.config);
        if (
            !response.config?.__skipGlobalFeedback &&
            response.data?.success === false
        ) {
            const message = response.data.message?.msg || response.data.message;
            const error = new Error(
                typeof message === "string" ? message : "The request was not successful."
            );
            notifyApiError(error.message);
            return Promise.reject(error);
        }
        return response;
    },
    (error) => {
        endTrackedRequest(error.config);
        const status = error.response?.status;
        const message =
            error.response?.data?.message?.msg ||
            error.response?.data?.message ||
            "";
        if (status === 401 && !error.config?.__skipGlobalFeedback) {
            triggerSessionExpiry();
        } else if (!error.config?.__skipGlobalFeedback) {
            notifyApiError(
                typeof message === "string"
                    ? message
                    : error.message || "The request failed. Please try again."
            );
        }

        return Promise.reject(error);
    }
);

export async function postData(url, payload) {
    const config =
        payload instanceof FormData
            ? { headers: { "Content-Type": "multipart/form-data" } }
            : {};
    const res = await axiosInstance.post(url, payload, config);
    return res.data;
}

export async function getData(url, params) {
    const res = await axiosInstance.get(url, { params });
    return res.data;
}

export async function putData(url, payload) {
    const config =
        payload instanceof FormData
            ? { headers: { "Content-Type": "multipart/form-data" } }
            : {};

    const res = await axiosInstance.put(url, payload, config);
    return res.data;
}

export async function deleteData(url) {
    const res = await axiosInstance.delete(url);
    return res.data;
}

export async function patchData(url, payload) {
    const config =
        payload instanceof FormData
            ? { headers: { "Content-Type": "multipart/form-data" } }
            : {};

    const res = await axiosInstance.patch(url, payload, config);
    return res.data;
}