"""Logistic regression as one flat numpy vector: weights[0:18] + bias[18]."""
import numpy as np

from data_gen import N_FEATURES

N_PARAMS = N_FEATURES + 1


def init():
    return np.zeros(N_PARAMS)


def predict(w, X):
    return 1 / (1 + np.exp(-(X @ w[:-1] + w[-1])))


def _centre(X):
    # shape features sit around 1.0; centring them keeps plain gradient descent well-conditioned
    Xc = X.copy()
    Xc[:, :12] -= 1
    return Xc


def local_train(w, X, y, epochs=20, lr=0.5, l2=1e-3):
    """Full-batch gradient descent on the client's own data. Returns new weights; data never leaves."""
    w = w.copy()
    Xc = _centre(X)
    for _ in range(epochs):
        p = predict(w, Xc)
        g = p - y
        w[:-1] -= lr * (Xc.T @ g / len(y) + l2 * w[:-1])
        w[-1] -= lr * g.mean()
    return w


def auc(y, p):
    # rank-based (Mann-Whitney) AUC, ties averaged
    order = np.argsort(p)
    ranks = np.empty(len(p))
    ranks[order] = np.arange(1, len(p) + 1)
    for v in np.unique(p):
        m = p == v
        if m.sum() > 1:
            ranks[m] = ranks[m].mean()
    pos = y == 1
    n_pos, n_neg = pos.sum(), (~pos).sum()
    return float((ranks[pos].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def evaluate(w, X, y):
    p = np.clip(predict(w, _centre(X)), 1e-7, 1 - 1e-7)
    return {
        "auc": round(auc(y, p), 4),
        "accuracy": round(float(((p > 0.5) == y).mean()), 4),
        "log_loss": round(float(-(y * np.log(p) + (1 - y) * np.log(1 - p)).mean()), 4),
    }
