"""
URL configuration for flowchat project.
"""
from django.contrib import admin
from django.http import JsonResponse, HttpResponse
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# Make the admin "View site" link open the React app
admin.site.site_url = settings.FRONTEND_URL

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/chat/', include('chat.urls')),
    # Health & landing
    path('', lambda request: HttpResponse(
        '<!doctype html><html><head><meta charset="utf-8"><title>FlowChat API</title>'
        '<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:32px;line-height:1.6;background:#fafafa;color:#111} .card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:24px;max-width:720px} a{color:#2563eb;text-decoration:none} a:hover{text-decoration:underline} code{background:#f3f4f6;padding:2px 6px;border-radius:4px}</style>'
        '</head><body><div class="card">'
        '<h1>FlowChat Backend</h1>'
        '<p>This is the Django API server. The React app runs at <code>http://localhost:3000</code>.</p>'
        '<ul>'
        '<li><a href="/admin/">/admin/</a></li>'
        '<li><a href="/api/auth/">/api/auth/</a></li>'
        '<li><a href="/api/chat/">/api/chat/</a></li>'
        '<li><a href="/healthz">/healthz</a> (JSON health)</li>'
        '</ul>'
        '</div></body></html>'
    )),
    path('healthz', lambda request: JsonResponse({'status': 'ok'})),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
