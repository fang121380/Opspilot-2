from app.domain.kubernetes import is_dns_label


def test_dns_label_validation_is_bounded() -> None:
    assert is_dns_label("checkout") is True
    assert is_dns_label("checkout-v2") is True
    assert is_dns_label("checkout,app") is False
    assert is_dns_label("Checkout") is False
    assert is_dns_label("a" * 64) is False
