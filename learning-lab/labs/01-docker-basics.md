# 01 Docker 基础 / Docker Basics

## 目标 / Goal

建立“镜像是模板、容器是运行实例、端口是访问通道”的直觉。

Build the mental model: an image is a template, a container is a running instance, and a port is the access path.

## 操作 / Do

```bash
docker pull nginx:1.27-alpine
docker run -d --name lab-nginx -p 8081:80 nginx:1.27-alpine
curl -I http://127.0.0.1:8081
docker ps
docker logs lab-nginx
docker rm -f lab-nginx
```

## 验收 / Acceptance

- [ ] `curl` 返回 HTTP 200 / `curl` returns HTTP 200.
- [ ] 能在 `docker ps` 中找到容器 / the container appears in `docker ps`.
- [ ] 删除容器后 `docker ps -a` 不再保留它 / it is gone from `docker ps -a`.

