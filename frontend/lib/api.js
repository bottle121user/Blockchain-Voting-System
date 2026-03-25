import axios from 'axios';

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api', // Matches our Express Relayer backend port
    headers: {
        'Content-Type': 'application/json'
    }
});

// Auto-inject JWT token if present in localStorage
api.interceptors.request.use(config => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('voterToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

export default api;
