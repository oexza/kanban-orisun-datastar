export function BasePage({
                             title,
                             children,
                         }: {
    title: string;
    children: any;
}) {
    const isDev = process.env.BUN_ENV !== "production";

    return (
        <html lang="en">
        <head>
            <meta charset="UTF-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            {/* -- Sync load main CSS */}
            <link href="/static/style.css" rel="stylesheet"/>
            {/* Async load DaisyUI from CDN */}
            <link
                href="https://cdn.jsdelivr.net/npm/daisyui@5"
                type="text/css"
                rel="stylesheet"
                media="print"
                onload="this.media='all'; this.onload=null;"
            />
            {/* Async load charts.css from CDN */}
            <link
                href="https://cdn.jsdelivr.net/npm/charts.css/dist/charts.min.css"
                rel="stylesheet"
                media="print"
                onload="this.media='all'; this.onload=null;"
            />
            <link href="/static/favicon.png" rel="icon" type="image/png"/>
            <title>{title}</title>
            <script type="module" src="/static/datastar.js"></script>
            <style dangerouslySetInnerHTML={{
                __html: `
                :root {
                    --sl-color-primary-600: #67859a;
                }
                body {
                    font-family: var(--sl-font-sans);
                }

                /* View transitions with fallbacks for webviews */
                @supports (view-transition-name: none) {
                    @view-transition {
                        navigation: auto;
                    }
                    ::view-transition-group(root) {
                        animation-duration: 0.6s;
                    }
                    ::view-transition-old(root),
                    ::view-transition-new(root) {
                        animation-duration: 0.6s;
                    }

                    @keyframes fade-in {
                        from { opacity: 0; }
                    }

                    @keyframes fade-out {
                        to { opacity: 0; }
                    }

                    @keyframes slide-from-right {
                        from {
                            transform: translateX(100px) scale(0.95);
                            opacity: 0;
                        }
                    }

                    @keyframes slide-to-left {
                        to {
                            transform: translateX(-100px) scale(0.95);
                            opacity: 0;
                        }
                    }

                    @keyframes scale-in {
                        from {
                            transform: scale(0.9);
                            opacity: 0;
                        }
                    }

                    @keyframes scale-out {
                        to {
                            transform: scale(1.1);
                            opacity: 0;
                        }
                    }

                    @keyframes blur-in {
                        from {
                            filter: blur(10px);
                            opacity: 0;
                        }
                    }

                    @keyframes blur-out {
                        to {
                            filter: blur(10px);
                            opacity: 0;
                        }
                    }

                    @keyframes elastic-in {
                        0% {
                            transform: scale(0.8) translateY(40px);
                            opacity: 0;
                        }
                        50% {
                            transform: scale(1.02) translateY(-5px);
                        }
                        70% {
                            transform: scale(0.98) translateY(2px);
                        }
                        100% {
                            transform: scale(1) translateY(0);
                            opacity: 1;
                        }
                    }

                    /* Enhanced slide animations with scale and blur */
                    ::view-transition-old(slide-it) {
                        animation:
                            300ms cubic-bezier(0.4, 0, 1, 1) both fade-out,
                            600ms cubic-bezier(0.4, 0, 0.2, 1) both slide-to-left,
                            300ms ease-out both scale-out,
                            300ms ease-out both blur-out;
                    }

                    ::view-transition-new(slide-it) {
                        animation:
                            200ms cubic-bezier(0, 0, 0.2, 1) 100ms both fade-in,
                            600ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms both slide-from-right,
                            600ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms both scale-in,
                            400ms ease-out 100ms both blur-in;
                    }

                    /* Elastic bounce effect for root transitions */
                    ::view-transition-old(root) {
                        animation: 250ms ease-in both fade-out, 250ms ease-in both scale-out;
                    }

                    ::view-transition-new(root) {
                        animation: 600ms cubic-bezier(0.34, 1.56, 0.64, 1) both elastic-in;
                    }

                    /* Add 3D perspective effect */
                    ::view-transition-old(slide-it),
                    ::view-transition-new(slide-it) {
                        transform-origin: center left;
                    }
                }

                /* Fallback for browsers/webviews without view-transition support */
                @supports not (view-transition-name: none) {
                    /* Simple page transitions using CSS animations on body */
                    body {
                        animation: page-fade-in 0.4s ease-out;
                    }

                    @keyframes page-fade-in {
                        from {
                            opacity: 0;
                            transform: translateY(10px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }

                    /* Smooth transitions for anchor links */
                    a {
                        transition: opacity 0.2s ease;
                    }
                    a:hover {
                        opacity: 0.8;
                    }

                    /* Card hover effects */
                    .card {
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                    }
                    .card:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }

                    /* Button press effect */
                    button, .btn {
                        transition: transform 0.1s ease;
                    }
                    button:active, .btn:active {
                        transform: scale(0.98);
                    }
                }

                /* Universal smooth animations that work everywhere */
                * {
                    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                }

                /* Reduce motion for accessibility */
                @prefers-reduced-motion {
                    *, ::view-transition-old(*), ::view-transition-new(*) {
                        animation: none !important;
                        transition: none !important;
                    }
                }
                `
            }} />
        </head>
        <body>
        {children}
        {isDev && (
            <div
                id="hotreload"
                data-init="@get('/hotreload', {retryMaxCount: 1000, retryInterval: 20, retryMaxWaitMs: 200})"
            />
        )}
        </body>
        </html>
    );
}
