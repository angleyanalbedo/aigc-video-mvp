
// 审核状态枚举
const REVIEW_STATES = {
  PENDING: 'pending',
  REVIEWING: 'reviewing',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// 模拟审核记录存储
const reviewStore = new Map();
let reviewIdCounter = 1;

/**
 * 合规审核服务类
 */
class ComplianceService {
  constructor() {
    this.reviewStore = reviewStore;
  }

  /**
   * 创建新的审核任务
   * @param {Object} content - 需要审核的内容
   * @param {string} content.title - 标题
   * @param {string} content.description - 描述
   * @param {string} content.type - 内容类型 (video/script/product)
   * @param {string} [content.creator] - 创建者
   * @returns {Object} 审核任务
   */
  createReview(content) {
    const reviewId = `review_${reviewIdCounter++}`;
    const now = Date.now();

    const review = {
      id: reviewId,
      content: {
        title: content.title,
        description: content.description,
        type: content.type || 'video',
        creator: content.creator || 'anonymous'
      },
      status: REVIEW_STATES.PENDING,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          action: 'created',
          timestamp: now,
          note: '审核任务已创建'
        }
      ],
      complianceCheck: null,
      copyrightCheck: null,
      reviewer: null,
      reviewNote: null
    };

    this.reviewStore.set(reviewId, review);
    return review;
  }

  /**
   * 启动内容合规检查 (Mock)
   * @param {string} reviewId - 审核任务ID
   * @returns {Promise<Object>} 检查结果
   */
  async startComplianceCheck(reviewId) {
    const review = this._getReview(reviewId);
    if (!review) {
      throw new Error('审核任务不存在');
    }

    this._updateStatus(review, REVIEW_STATES.REVIEWING);

    // 模拟合规检查
    await this._sleep(1500);

    const checkResult = {
      passed: Math.random() > 0.2, // 80% 通过率
      checkItems: {
        sensitiveContent: Math.random() > 0.1,
        adCompliance: Math.random() > 0.15,
        contentQuality: Math.random() > 0.1
      },
      details: [
        '敏感词检测通过',
        '广告合规性检查通过',
        '内容质量评估通过'
      ],
      checkedAt: Date.now()
    };

    if (!checkResult.passed) {
      checkResult.details.push('发现潜在合规风险');
    }

    review.complianceCheck = checkResult;
    review.updatedAt = Date.now();

    this._addHistory(review, 'compliance_check', checkResult.passed ? '合规检查通过' : '合规检查发现问题');

    return checkResult;
  }

  /**
   * 启动版权校验 (Mock)
   * @param {string} reviewId - 审核任务ID
   * @returns {Promise<Object>} 检查结果
   */
  async startCopyrightCheck(reviewId) {
    const review = this._getReview(reviewId);
    if (!review) {
      throw new Error('审核任务不存在');
    }

    // 模拟版权检查
    await this._sleep(1200);

    const checkResult = {
      passed: Math.random() > 0.15, // 85% 通过率
      checkItems: {
        imageCopyright: Math.random() > 0.1,
        musicCopyright: Math.random() > 0.05,
        contentOriginality: Math.random() > 0.08
      },
      details: [
        '图片版权检查通过',
        '音乐版权检查通过',
        '内容原创性评估通过'
      ],
      checkedAt: Date.now()
    };

    if (!checkResult.passed) {
      checkResult.details.push('存在版权风险');
    }

    review.copyrightCheck = checkResult;
    review.updatedAt = Date.now();

    this._addHistory(review, 'copyright_check', checkResult.passed ? '版权校验通过' : '版权校验发现问题');

    return checkResult;
  }

  /**
   * 执行完整审核流程
   * @param {string} reviewId - 审核任务ID
   * @returns {Promise<Object>} 审核结果
   */
  async executeFullReview(reviewId) {
    const review = this._getReview(reviewId);
    if (!review) {
      throw new Error('审核任务不存在');
    }

    // 先做合规检查
    const complianceResult = await this.startComplianceCheck(reviewId);

    // 再做版权检查
    const copyrightResult = await this.startCopyrightCheck(reviewId);

    // 综合判断
    const allPassed = complianceResult.passed && copyrightResult.passed;

    // 更新最终状态
    if (allPassed) {
      await this.approveReview(reviewId, '自动审核通过');
    } else {
      await this.rejectReview(reviewId, '自动审核未通过');
    }

    return this._getReview(reviewId);
  }

  /**
   * 人工审核通过
   * @param {string} reviewId - 审核任务ID
   * @param {string} [note] - 审核备注
   * @param {string} [reviewer] - 审核人
   * @returns {Object} 更新后的审核任务
   */
  approveReview(reviewId, note = '', reviewer = 'system') {
    const review = this._getReview(reviewId);
    if (!review) {
      throw new Error('审核任务不存在');
    }

    review.status = REVIEW_STATES.APPROVED;
    review.reviewer = reviewer;
    review.reviewNote = note || '审核通过';
    review.updatedAt = Date.now();

    this._addHistory(review, 'approved', `审核通过: ${note || '无备注'}`);

    return review;
  }

  /**
   * 人工审核拒绝
   * @param {string} reviewId - 审核任务ID
   * @param {string} [note] - 拒绝原因
   * @param {string} [reviewer] - 审核人
   * @returns {Object} 更新后的审核任务
   */
  rejectReview(reviewId, note = '', reviewer = 'system') {
    const review = this._getReview(reviewId);
    if (!review) {
      throw new Error('审核任务不存在');
    }

    review.status = REVIEW_STATES.REJECTED;
    review.reviewer = reviewer;
    review.reviewNote = note || '审核拒绝';
    review.updatedAt = Date.now();

    this._addHistory(review, 'rejected', `审核拒绝: ${note || '无原因'}`);

    return review;
  }

  /**
   * 获取单个审核任务详情
   * @param {string} reviewId - 审核任务ID
   * @returns {Object|null} 审核任务
   */
  getReview(reviewId) {
    return this._getReview(reviewId);
  }

  /**
   * 获取审核列表
   * @param {Object} [filters] - 过滤条件
   * @param {string} [filters.status] - 状态过滤
   * @param {string} [filters.type] - 内容类型过滤
   * @param {number} [filters.limit=20] - 返回数量限制
   * @returns {Array} 审核列表
   */
  getReviewList(filters = {}) {
    let reviews = Array.from(this.reviewStore.values());

    // 状态过滤
    if (filters.status) {
      reviews = reviews.filter(r => r.status === filters.status);
    }

    // 类型过滤
    if (filters.type) {
      reviews = reviews.filter(r => r.content.type === filters.type);
    }

    // 按时间倒序
    reviews.sort((a, b) => b.createdAt - a.createdAt);

    // 限制数量
    if (filters.limit) {
      reviews = reviews.slice(0, filters.limit);
    }

    return reviews;
  }

  /**
   * 获取审核统计
   * @returns {Object} 统计数据
   */
  getStats() {
    const reviews = Array.from(this.reviewStore.values());
    const stats = {
      total: reviews.length,
      pending: 0,
      reviewing: 0,
      approved: 0,
      rejected: 0,
      todayCount: 0
    };

    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    reviews.forEach(review => {
      stats[review.status] = (stats[review.status] || 0) + 1;
      if (review.createdAt >= todayStart) {
        stats.todayCount++;
      }
    });

    return stats;
  }

  /**
   * 删除审核任务
   * @param {string} reviewId - 审核任务ID
   * @returns {boolean} 是否删除成功
   */
  deleteReview(reviewId) {
    return this.reviewStore.delete(reviewId);
  }

  // ========== 内部方法 ==========

  _getReview(reviewId) {
    return this.reviewStore.get(reviewId) || null;
  }

  _updateStatus(review, newStatus) {
    review.status = newStatus;
    review.updatedAt = Date.now();
    this._addHistory(review, 'status_change', `状态变更为: ${newStatus}`);
  }

  _addHistory(review, action, note) {
    review.history.push({
      action,
      timestamp: Date.now(),
      note
    });
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = {
  ComplianceService,
  REVIEW_STATES,
  reviewStore
};
