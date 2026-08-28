FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml README.md ./
# 先用最小包骨架缓存第三方依赖；应用源码变化不再触发完整依赖下载。
RUN mkdir app && touch app/__init__.py && pip install --no-cache-dir .
COPY app ./app
RUN pip install --no-cache-dir --no-deps .

RUN addgroup --system app && adduser --system --ingroup app app
USER app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
