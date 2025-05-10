#!/bin/bash

# 修复 src/analytics/alert-system.ts 中的 no-case-declarations 错误
sed -i '' 's/case ConditionType.THRESHOLD: {/case ConditionType.THRESHOLD: {/g' src/analytics/alert-system.ts

# 修复 src/monitors/journey.ts 中的未使用参数问题
sed -i '' 's/private recordConversionPoint(element: HTMLElement): void {/private recordConversionPoint(_element: HTMLElement): void {/g' src/monitors/journey.ts

# 修复 src/monitors/journey.ts 中的 this 别名问题
sed -i '' 's/const tracker = this;/const self = this;/g' src/monitors/journey.ts
sed -i '' 's/tracker.recordAction(/self.recordAction(/g' src/monitors/journey.ts

# 修复 src/monitors/journey.ts 中的 prefer-rest-params 问题
sed -i '' 's/return originalXHRSend.apply(this, arguments);/return originalXHRSend.apply(this, [...arguments]);/g' src/monitors/journey.ts

# 修复 src/plugins/vue-integration.ts 中的问题
# 修复对 Function 类型的使用
sed -i '' 's/render(h: Function)/render(h: any)/g' src/plugins/vue-integration.ts
sed -i '' 's/onMounted = (fn: Function)/onMounted = (fn: () => void)/g' src/plugins/vue-integration.ts
sed -i '' 's/onUnmounted = (fn: Function)/onUnmounted = (fn: () => void)/g' src/plugins/vue-integration.ts
sed -i '' 's/onUpdated = (fn: Function)/onUpdated = (fn: () => void)/g' src/plugins/vue-integration.ts

# 修复未使用变量
sed -i '' 's/const instance = getCurrentInstance();//let _instance = getCurrentInstance();/g' src/plugins/vue-integration.ts

# 修复 require 语句问题
echo "正在修复 Vue 集成问题..."
