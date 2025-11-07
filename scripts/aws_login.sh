#!/usr/bin/env bash
set -e

ACCOUNT_ID=345034663883
USERNAME=dev.nghianguyen
PROFILE_NAME=mfa-session

# === Lấy MFA serial number tự động ===
MFA_SERIAL=$(aws iam list-mfa-devices \
  --user-name "$USERNAME" \
  --query 'MFADevices[0].SerialNumber' \
  --output text 2>/dev/null)

if [[ -z "$MFA_SERIAL" || "$MFA_SERIAL" == "None" ]]; then
  echo "❌ Không tìm thấy MFA device cho user $USERNAME. Kiểm tra IAM console!"
  exit 1
fi

echo "🔹 MFA device: $MFA_SERIAL"
read -p "🔐 Nhập mã MFA cho $USERNAME: " TOKEN

# === Lấy temporary session token (valid ~12h) ===
echo "⏳ Đang tạo phiên đăng nhập MFA tạm thời..."
if ! aws sts get-session-token \
  --serial-number "$MFA_SERIAL" \
  --token-code "$TOKEN" \
  --output json > /tmp/session.json 2>/tmp/session_error.log; then
  echo "❌ Lỗi khi gọi AWS STS:"
  cat /tmp/session_error.log
  exit 1
fi

ACCESS_KEY=$(jq -r .Credentials.AccessKeyId /tmp/session.json)
SECRET_KEY=$(jq -r .Credentials.SecretAccessKey /tmp/session.json)
SESSION_TOKEN=$(jq -r .Credentials.SessionToken /tmp/session.json)
EXPIRATION=$(jq -r .Credentials.Expiration /tmp/session.json)

if [[ "$ACCESS_KEY" == "null" ]]; then
  echo "❌ Không nhận được session key. Kiểm tra lại mã MFA hoặc quyền IAM."
  exit 1
fi

# === Ghi cấu hình vào profile ===
aws configure set aws_access_key_id "$ACCESS_KEY" --profile "$PROFILE_NAME"
aws configure set aws_secret_access_key "$SECRET_KEY" --profile "$PROFILE_NAME"
aws configure set aws_session_token "$SESSION_TOKEN" --profile "$PROFILE_NAME"

# === Xóa file tạm ===
rm -f /tmp/session.json /tmp/session_error.log

echo "✅ Tạo profile MFA thành công: $PROFILE_NAME"
echo "🕒 Phiên này sẽ hết hạn lúc: $EXPIRATION (UTC)"
echo "💡 Dùng profile này với: --profile $PROFILE_NAME"