import logging


def get_logger(name: str) -> logging.Logger:
    """Use the server's logging configuration without replacing its handlers."""
    return logging.getLogger(name)
