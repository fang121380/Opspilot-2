# 01 Docker 基础 / Docker Basics

## 目标与模式 / Goal and Mode

镜像是模板；容器是由镜像创建的实例，可以运行或停止；端口发布让主机访问容器服务。网页课程仅模拟 hello-world。以下是额外的真实 Docker 练习，会下载示例镜像并创建容器。

An image is a template; its container instance can run or stop. Publishing a port provides host access to the service. The website simulates hello-world only. This additional real Docker exercise downloads the sample image and creates a container.

## 操作 / Practice

先用 `docker ps -a` 检查名字。若 `learning-lab-nginx-example` 已存在，不覆盖或删除未知容器，先确认来源。以下命令只操作本次创建的同名示例，端口只绑定主机 loopback。

Check names with `docker ps -a`. If `learning-lab-nginx-example` exists, identify it before proceeding; do not replace or delete an unknown container. Commands below apply only to the example you create and bind its port to host loopback.

```text
docker pull nginx:1.27-alpine
docker run -d --name learning-lab-nginx-example -p 127.0.0.1:8081:80 nginx:1.27-alpine
docker ps
docker logs learning-lab-nginx-example
```

macOS 用 `curl -I http://127.0.0.1:8081`，Windows PowerShell 用 `curl.exe -I http://127.0.0.1:8081`。请求后再次查看日志。`8081` 是主机端口，`80` 是容器端口；Android 不能直接访问这个 loopback 地址。

Use `curl -I http://127.0.0.1:8081` on macOS or `curl.exe -I http://127.0.0.1:8081` in Windows PowerShell, then inspect logs again. Port `8081` belongs to the host; `80` belongs to the container. Android cannot directly access this loopback endpoint.

完成观察后清理本次容器 / After observing, clean up this container:

```text
docker stop learning-lab-nginx-example
docker ps -a
docker rm learning-lab-nginx-example
docker ps -a
docker image ls
```

## 验收 / Acceptance

- [ ] 本次请求返回 HTTP 200，日志有对应请求 / Observe HTTP 200 and its request log.
- [ ] stop 后容器仍在 `docker ps -a`，rm 后消失 / Observe stopped versus removed state.
- [ ] 镜像仍可保留，能解释为何移除容器不等于移除镜像 / Explain independent image retention.
- [ ] 不运行全局 prune，不清理其他容器 / No global prune or unrelated container cleanup.
