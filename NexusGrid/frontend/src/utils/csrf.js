let csrfToken = null;

export const setCSRFToken = (token) => {
    csrfToken = token;
};

export const getCSRFToken = () => {
    return csrfToken;
};