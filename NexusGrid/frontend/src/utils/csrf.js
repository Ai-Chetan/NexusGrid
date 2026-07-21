let csrfToken = null;

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim();
const apiBaseURL = configuredApiBase
    ? configuredApiBase.replace(/\/+$/, '')
    : '/api/v1';

export const fetchCSRFToken = async () => {
    const response = await fetch(`${apiBaseURL}/csrf/`, {
        method: 'GET',
        credentials: 'include',
    });

    const data = await response.json();

    csrfToken = data.csrfToken ?? null;

    return csrfToken;

};

export const setCSRFToken = (token) => {
    csrfToken = token;
};

export const getCSRFToken = () => {
    return csrfToken;
};