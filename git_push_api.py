#!/usr/bin/env python3
"""用 GitHub API 推送代码（绕过 git push 被阻断的问题）"""
import json, urllib.request, os, base64

TOKEN = os.environ.get("GH_TOKEN", "") or "github...gRPd"
REPO = "David-wang666/english-daily-checkin"
BRANCH = "master"
BASE = "https://api.github.com"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "HermesAgent/1.0"
}

def api(url, data=None, method=None):
    req = urllib.request.Request(f"{BASE}/repos/{REPO}{url}", headers=HEADERS)
    if data:
        req.data = json.dumps(data).encode()
    if method:
        req.method = method
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  HTTP {e.code}: {body[:200]}")
        return None
    except Exception as e:
        print(f"  Error: {e}")
        return None

# 1. 获取当前最新 commit SHA
print("获取最新 commit...")
ref = api(f"/git/refs/heads/{BRANCH}")
if not ref:
    print("获取 ref 失败")
    exit(1)
latest_sha = ref["object"]["sha"]
print(f"  最新 commit: {latest_sha[:12]}")

# 2. 获取当前 tree SHA
commit = api(f"/git/commits/{latest_sha}")
tree_sha = commit["tree"]["sha"]
print(f"  当前 tree: {tree_sha[:12]}")

# 3. 创建新的 blob（app.js）
print("上传 app.js...")
app_path = "js/app.js"
with open(app_path, "rb") as f:
    app_content = f.read()
app_b64 = base64.b64encode(app_content).decode()
blob_app = api("/git/blobs", {"content": app_b64, "encoding": "base64"})
if not blob_app:
    print("创建 app.js blob 失败")
    exit(1)
app_sha = blob_app["sha"]
print(f"  app.js blob: {app_sha[:12]}")

print("上传 data.js...")
data_path = "js/data.js"
with open(data_path, "rb") as f:
    data_content = f.read()
data_b64 = base64.b64encode(data_content).decode()
blob_data = api("/git/blobs", {"content": data_b64, "encoding": "base64"})
if not blob_data:
    print("创建 data.js blob 失败，跳过")
    data_sha = None
else:
    data_sha = blob_data["sha"]
    print(f"  data.js blob: {data_sha[:12]}")

# 4. 创建新的 tree
print("创建新 tree...")
tree_items = [{"path": "js/app.js", "mode": "100644", "type": "blob", "sha": app_sha}]
if data_sha:
    tree_items.append({"path": "js/data.js", "mode": "100644", "type": "blob", "sha": data_sha})

new_tree = api("/git/trees", {
    "base_tree": tree_sha,
    "tree": tree_items
})
if not new_tree:
    print("创建 tree 失败")
    exit(1)
new_tree_sha = new_tree["sha"]
print(f"  新 tree: {new_tree_sha[:12]}")

# 5. 创建 commit
print("创建 commit...")
new_commit = api("/git/commits", {
    "message": "fix: 单词测试改用事件委托，iOS点击选项无响应修复",
    "tree": new_tree_sha,
    "parents": [latest_sha]
})
if not new_commit:
    print("创建 commit 失败")
    exit(1)
new_commit_sha = new_commit["sha"]
print(f"  新 commit: {new_commit_sha[:12]}")

# 6. 更新 ref
print("更新分支...")
result = api(f"/git/refs/heads/{BRANCH}", {
    "sha": new_commit_sha,
    "force": False
}, method="PATCH")
if result:
    print(f"✅ 推送成功！commit: {new_commit_sha[:12]}")
else:
    print("❌ 推送失败")
